import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  BriefingType,
  GovBriefingEntity,
} from '../../database/entities/gov-briefing.entity';
import type { BriefingStatus } from '../../database/entities/gov-briefing.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { LlmRouterService } from '../agents/llm-router.service';
import { GovBriefingExportService } from './gov-briefing-export.service';
import { GovSubmitService } from './gov-submit.service';

interface BriefingAnalysis {
  eventCount: number;
  negativeCount: number;
  positiveCount: number;
  neutralCount: number;
  platformStats: Record<string, number>;
  topEvents: OpinionEventEntity[];
  totalReads: number;
  totalInteractions: number;
}

@Injectable()
export class GovBriefingService {
  private readonly logger = new Logger(GovBriefingService.name);

  constructor(
    @InjectRepository(GovBriefingEntity)
    private readonly briefingRepo: Repository<GovBriefingEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
    private readonly llmRouter: LlmRouterService,
    private readonly exportService: GovBriefingExportService,
    private readonly submitService: GovSubmitService,
  ) {}

  async generate(data: {
    briefingType: BriefingType;
    startDate: Date;
    endDate: Date;
    title?: string;
    useLlm?: boolean;
    createdBy: number;
  }): Promise<GovBriefingEntity> {
    this.assertDateRange(data.startDate, data.endDate);

    const events = await this.collectEvents(data.startDate, data.endDate);
    const analysis = this.analyzeEvents(events);
    const useLlm = data.useLlm !== false;
    const content = useLlm
      ? await this.generateLlmContent(data.briefingType, data.startDate, data.endDate, analysis)
      : this.buildTemplateContent(data.briefingType, data.startDate, data.endDate, analysis);

    const briefing = this.briefingRepo.create({
      briefingType: data.briefingType,
      title: data.title || this.defaultTitle(data.briefingType, data.startDate),
      startDate: data.startDate,
      endDate: data.endDate,
      content,
      status: 'generated',
      exportFormat: null,
      exportUrl: null,
      submittedAt: null,
      submittedTo: null,
      createdBy: data.createdBy,
    });

    return this.briefingRepo.save(briefing);
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    briefingType?: BriefingType;
    status?: BriefingStatus;
  }): Promise<{ data: GovBriefingEntity[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = this.briefingRepo.createQueryBuilder('briefing');

    if (params.briefingType) {
      query.andWhere('briefing.briefingType = :briefingType', {
        briefingType: params.briefingType,
      });
    }
    if (params.status) {
      query.andWhere('briefing.status = :status', { status: params.status });
    }

    query
      .orderBy('briefing.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getById(id: number): Promise<GovBriefingEntity> {
    const briefing = await this.briefingRepo.findOne({ where: { id } });
    if (!briefing) {
      throw new NotFoundException('政务简报不存在');
    }
    return briefing;
  }

  async submit(id: number, submittedTo: string, webhookUrl?: string): Promise<GovBriefingEntity> {
    const briefing = await this.getById(id);
    if (briefing.status === 'draft' || !briefing.content.trim()) {
      throw new BadRequestException('简报尚未生成，无法上报');
    }

    let pushed = false;
    if (webhookUrl) {
      pushed = await this.submitService.pushToWebhook(
        webhookUrl,
        briefing.title,
        briefing.content,
      );
    }

    briefing.status = 'submitted';
    briefing.submittedAt = new Date();
    briefing.submittedTo = submittedTo;
    return this.briefingRepo.save(briefing);
  }

  async export(
    id: number,
    format: 'word' | 'pdf',
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const briefing = await this.getById(id);

    let buffer: Buffer;
    let mimeType: string;
    let ext: string;

    if (format === 'word') {
      buffer = await this.exportService.exportWord(briefing.content, briefing.title);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      ext = 'docx';
    } else {
      buffer = await this.exportService.exportPdf(briefing.content, briefing.title);
      mimeType = 'application/pdf';
      ext = 'pdf';
    }

    const filename = `${briefing.title}.${ext}`;

    briefing.exportFormat = format;
    briefing.exportUrl = `/api/gov/briefing/${id}/export?format=${format}`;
    await this.briefingRepo.save(briefing);

    return { buffer, filename, mimeType };
  }

  async delete(id: number): Promise<void> {
    const briefing = await this.getById(id);
    await this.briefingRepo.remove(briefing);
  }

  private async collectEvents(startDate: Date, endDate: Date): Promise<OpinionEventEntity[]> {
    const inclusiveEnd = new Date(endDate);
    inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
    inclusiveEnd.setMilliseconds(-1);

    return this.eventRepo.find({
      where: { createdAt: Between(startDate, inclusiveEnd) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  private analyzeEvents(events: OpinionEventEntity[]): BriefingAnalysis {
    const negativeCount = events.filter((e) => e.sentiment === 'negative').length;
    const positiveCount = events.filter((e) => e.sentiment === 'positive').length;
    const neutralCount = events.length - negativeCount - positiveCount;

    const platformStats: Record<string, number> = {};
    for (const e of events) {
      platformStats[e.platform] = (platformStats[e.platform] || 0) + 1;
    }

    const topEvents = [...events]
      .sort((a, b) => b.readCount + b.likeCount + b.commentCount - (a.readCount + a.likeCount + a.commentCount))
      .slice(0, 10);

    const totalReads = events.reduce((sum, e) => sum + (e.readCount || 0), 0);
    const totalInteractions = events.reduce(
      (sum, e) => sum + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0),
      0,
    );

    return {
      eventCount: events.length,
      negativeCount,
      positiveCount,
      neutralCount,
      platformStats,
      topEvents,
      totalReads,
      totalInteractions,
    };
  }

  private async generateLlmContent(
    type: BriefingType,
    startDate: Date,
    endDate: Date,
    analysis: BriefingAnalysis,
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(type);
    const userPrompt = this.buildUserPrompt(type, startDate, endDate, analysis);

    try {
      const primaryModelId = await this.pickDefaultPrimary();
      const result = await this.llmRouter.chat({
        primaryModelId,
        fallbackModelIds: [],
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 4096,
      });
      return result.content;
    } catch (err) {
      this.logger.warn(`LLM 简报生成失败，降级为模板生成: ${(err as Error).message}`);
      return this.buildTemplateContent(type, startDate, endDate, analysis);
    }
  }

  private buildSystemPrompt(type: BriefingType): string {
    const typeName = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '专报';
    return [
      `你是一名专业的政务舆情分析师，擅长撰写面向政府领导的舆情${typeName}。`,
      '请根据提供的舆情监测数据，生成一份结构清晰、分析深入、建议可操作的简报。',
      '输出格式为 Markdown，包含以下部分：',
      '- 标题（# 开头）',
      '- 时间范围',
      '- 一、舆情概览（事件总数、情感分布、平台分布、传播数据）',
      '- 二、重点事件分析（TOP 事件、传播特征、风险研判）',
      '- 三、舆情趋势研判（趋势走向、潜在风险）',
      '- 四、应对建议（3-5 条具体可操作的建议）',
      '语言要求：正式、客观、简洁，避免使用网络用语。字数 800-1500 字。',
    ].join('\n');
  }

  private buildUserPrompt(
    type: BriefingType,
    startDate: Date,
    endDate: Date,
    analysis: BriefingAnalysis,
  ): string {
    const typeName = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '专报';
    const period = `${this.fmtDate(startDate)} 至 ${this.fmtDate(endDate)}`;
    const platformList = Object.entries(analysis.platformStats)
      .map(([p, c]) => `${p}: ${c} 条`)
      .join('、');

    const topEventsText = analysis.topEvents
      .map((e, i) => {
        return `${i + 1}. ${e.title}\n   平台: ${e.platform} | 情感: ${e.sentiment} | 阅读: ${e.readCount} | 点赞: ${e.likeCount} | 评论: ${e.commentCount} | 作者: ${e.author}`;
      })
      .join('\n');

    return [
      `请生成一份舆情监测${typeName}。`,
      `时间范围：${period}`,
      `事件总数：${analysis.eventCount} 条`,
      `情感分布：正面 ${analysis.positiveCount}、中性 ${analysis.neutralCount}、负面 ${analysis.negativeCount}`,
      `平台分布：${platformList || '暂无'}`,
      `总阅读量：${analysis.totalReads}，总互动量：${analysis.totalInteractions}`,
      '',
      '重点事件列表：',
      topEventsText || '暂无重点事件',
      '',
      '请基于以上数据生成完整的舆情简报。',
    ].join('\n');
  }

  private buildTemplateContent(
    type: BriefingType,
    startDate: Date,
    endDate: Date,
    analysis: BriefingAnalysis,
  ): string {
    const typeName = type === 'daily' ? '舆情监测日报' : type === 'weekly' ? '舆情监测周报' : '舆情监测专报';
    const period = `${this.fmtDate(startDate)} 至 ${this.fmtDate(endDate)}`;
    const platformList = Object.entries(analysis.platformStats)
      .map(([p, c]) => `- ${p}：${c} 条`)
      .join('\n');

    const topEventsList = analysis.topEvents
      .slice(0, 5)
      .map((e, i) => `${i + 1}. ${e.title}（${e.platform}，${e.sentiment}，阅读 ${e.readCount}）`)
      .join('\n');

    return [
      `# ${typeName}`,
      `时间范围：${period}`,
      '',
      '## 一、舆情概览',
      `- 监测事件数：${analysis.eventCount}`,
      `- 情感分布：正面 ${analysis.positiveCount}，中性 ${analysis.neutralCount}，负面 ${analysis.negativeCount}`,
      `- 总阅读量：${analysis.totalReads}`,
      `- 总互动量：${analysis.totalInteractions}`,
      '',
      '### 平台分布',
      platformList || '暂无数据',
      '',
      '## 二、重点事件',
      topEventsList || '暂无重点事件',
      '',
      '## 三、研判建议',
      analysis.negativeCount > 0
        ? '建议重点核查负面舆情，持续跟踪传播范围和处置进展。'
        : '当前负面舆情较少，建议保持常态化监测。',
    ].join('\n');
  }

  private async pickDefaultPrimary(): Promise<number> {
    const LlmModelEntity = require('../../database/entities').LlmModelEntity;
    const repo = this.briefingRepo.manager.getRepository(LlmModelEntity);
    const enabled = await repo.findOne({
      where: { isEnabled: 1 },
      order: { id: 'ASC' },
    });
    if (!enabled) {
      throw new BadRequestException('无可用 LLM 模型，请先在模型管理中配置');
    }
    return enabled.id;
  }

  private assertDateRange(startDate: Date, endDate: Date): void {
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.getTime() > endDate.getTime()
    ) {
      throw new BadRequestException('简报开始日期不能晚于结束日期');
    }
  }

  private defaultTitle(type: BriefingType, startDate: Date): string {
    const date = startDate.toISOString().slice(0, 10);
    const names: Record<BriefingType, string> = {
      daily: '舆情监测日报',
      weekly: '舆情监测周报',
      special: '舆情监测专报',
    };
    return `${names[type]}（${date}）`;
  }

  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
