import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReportTemplateEntity,
  TemplateType,
  OpinionEventEntity,
  MonitorTaskEntity,
  PrReportEntity,
  PrReportStatus,
} from '../../database/entities';
import { LlmRouterService } from '../agents/llm-router.service';

const PRESET_TEMPLATES: Array<{
  name: string;
  description: string;
  prompt: string;
  templateType: TemplateType;
  icon: string;
  structure: string;
}> = [
  {
    name: '日报模板',
    description: '按日生成舆情日报，含概览、热点事件、预警、竞品动态和明日关注',
    templateType: 'daily',
    icon: 'calendar',
    structure: JSON.stringify([
      '今日概览（总声量/情感分布/环比变化）',
      '热点事件TOP5（标题/平台/情感/趋势）',
      '预警信息（当前需关注的风险）',
      '竞品动态',
      '明日关注',
    ]),
    prompt:
      '你是舆情日报分析师。请根据以下数据生成一份舆情日报，包含：1. 今日概览（总声量/情感分布/环比变化）2. 热点事件TOP5（标题/平台/情感/趋势）3. 预警信息（当前需关注的风险）4. 竞品动态 5. 明日关注。数据：{data}',
  },
  {
    name: '周报模板',
    description: '按周生成舆情周报，含综述、关键发现、趋势分析和策略建议',
    templateType: 'weekly',
    icon: 'calendar-check',
    structure: JSON.stringify([
      '本周综述',
      '关键发现',
      '趋势分析',
      '竞品对比',
      '策略建议',
    ]),
    prompt:
      '你是舆情周报分析师。请根据以下一周数据生成舆情周报，包含：1. 本周综述 2. 关键发现 3. 趋势分析 4. 竞品对比 5. 策略建议。数据：{data}',
  },
  {
    name: '事件专报模板',
    description: '针对特定事件生成深度分析专报，含传播路径、情感分析和应对建议',
    templateType: 'event',
    icon: 'zap',
    structure: JSON.stringify([
      '事件概述',
      '传播路径',
      '情感分析',
      '风险评估',
      '应对建议',
    ]),
    prompt:
      '你是危机公关专家。请根据以下事件数据生成事件分析专报，包含：1. 事件概述 2. 传播路径 3. 情感分析 4. 风险评估 5. 应对建议。数据：{data}',
  },
  {
    name: '竞品对标模板',
    description: '多维度竞品对比分析，含声量、情感、平台分布和关键词对比',
    templateType: 'competitor',
    icon: 'trending-up',
    structure: JSON.stringify([
      '声量对比',
      '情感对比',
      '平台分布',
      '关键词对比',
      '策略建议',
    ]),
    prompt:
      '你是竞品分析师。请根据以下数据生成竞品对标报告，包含：1. 声量对比 2. 情感对比 3. 平台分布 4. 关键词对比 5. 策略建议。数据：{data}',
  },
  {
    name: '自定义模板',
    description: '自定义报告模板，可自由填写提示词和结构',
    templateType: 'custom',
    icon: 'edit',
    structure: '[]',
    prompt: '',
  },
];

@Injectable()
export class ReportTemplateService {
  private readonly logger = new Logger(ReportTemplateService.name);

  constructor(
    @InjectRepository(ReportTemplateEntity)
    private repo: Repository<ReportTemplateEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
    private llmRouterService: LlmRouterService,
  ) {}

  async list(userId: number, type?: string): Promise<ReportTemplateEntity[]> {
    void userId;
    const where: any = { isActive: 1 };
    if (type) where.templateType = type;
    return this.repo.find({ where, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async getById(id: number): Promise<ReportTemplateEntity> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('报告模板不存在');
    return t;
  }

  async generateFromTemplate(
    userId: number,
    templateId: number,
    options: {
      taskIds?: number[];
      timeRange?: string;
      customData?: string;
    },
  ): Promise<{ reportId: number; status: string }> {
    const template = await this.getById(templateId);

    let dataContent = options.customData || '';
    if (!dataContent && options.taskIds && options.taskIds.length > 0) {
      dataContent = await this.buildDataFromTasks(options.taskIds, options.timeRange);
    }

    const prompt = template.prompt.replace('{data}', dataContent || '(无数据)');
    const inputSnapshot = `## 模板: ${template.name}\n\n### 提示词\n${prompt}\n\n### 原始数据\n${dataContent}`;

    const report = this.prRepo.create({
      userId,
      eventId: null,
      agentId: null,
      inputSnapshot,
      status: PrReportStatus.PENDING,
      reportType: 'single',
      exportFormat: 'markdown',
    });
    const saved = await this.prRepo.save(report);

    setImmediate(() => {
      this.doGenerate(saved.id, prompt).catch((err) =>
        this.logger.error(`Template report generation failed: ${(err as Error).message}`),
      );
    });

    return { reportId: saved.id, status: saved.status };
  }

  async getPresetTemplates(): Promise<ReportTemplateEntity[]> {
    return this.repo.find({ where: { isPreset: 1, isActive: 1 }, order: { sortOrder: 'ASC' } });
  }

  async seedPresets(): Promise<void> {
    const count = await this.repo.count({ where: { isPreset: 1 } });
    if (count > 0) return;
    this.logger.log('Seeding preset report templates...');
    for (const p of PRESET_TEMPLATES) {
      const exists = await this.repo.findOne({ where: { name: p.name, isPreset: 1 } });
      if (exists) continue;
      await this.repo.save(
        this.repo.create({ ...p, isPreset: 1, isActive: 1, sortOrder: 0 }),
      );
    }
  }

  async create(dto: {
    name: string;
    description: string;
    prompt: string;
    templateType: TemplateType;
    structure?: string;
    icon?: string;
  }): Promise<ReportTemplateEntity> {
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        description: dto.description,
        prompt: dto.prompt,
        templateType: dto.templateType,
        structure: dto.structure || null,
        icon: dto.icon || 'file-text',
        isPreset: 0,
        isActive: 1,
      }),
    );
  }

  async update(
    id: number,
    dto: Partial<{
      name: string;
      description: string;
      prompt: string;
      templateType: TemplateType;
      structure: string;
      icon: string;
      isActive: number;
    }>,
  ): Promise<ReportTemplateEntity> {
    const t = await this.getById(id);
    if (t.isPreset) throw new BadRequestException('预设模板不允许修改');
    Object.assign(t, dto);
    return this.repo.save(t);
  }

  async delete(id: number): Promise<void> {
    const t = await this.getById(id);
    if (t.isPreset) throw new BadRequestException('预设模板不允许删除');
    await this.repo.remove(t);
  }

  private async buildDataFromTasks(taskIds: number[], timeRange?: string): Promise<string> {
    const tasks = await this.taskRepo.findByIds(taskIds);
    if (!tasks.length) return '';

    const since = timeRange
      ? new Date(Date.now() - this.parseTimeRange(timeRange))
      : new Date(Date.now() - 86400000);

    const events = await this.eventRepo.find({
      where: { taskId: { $in: taskIds } as any, matchedAt: { $gte: since } as any },
      order: { matchedAt: 'DESC' },
      take: 100,
    });

    const lines: string[] = [];
    lines.push(`任务数: ${tasks.length}`);
    lines.push(`时间范围: ${since.toISOString().slice(0, 10)} 至今`);
    lines.push(`事件数: ${events.length}`);
    lines.push('');
    for (const e of events.slice(0, 50)) {
      const sentiment = e.sentiment === 'positive' ? '正面' : e.sentiment === 'negative' ? '负面' : '中性';
      const engagement = (e.readCount || 0) + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0);
      lines.push(`[${e.platform}] ${e.title} | ${sentiment} | 互动:${engagement} | ${e.matchedAt.toISOString().slice(0, 10)}`);
    }
    return lines.join('\n');
  }

  private parseTimeRange(range: string): number {
    const match = range.match(/^(\d+)([dhms])$/);
    if (!match) return 86400000;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'd': return n * 86400000;
      case 'h': return n * 3600000;
      case 'm': return n * 60000;
      case 's': return n * 1000;
      default: return 86400000;
    }
  }

  private async doGenerate(reportId: number, prompt: string): Promise<void> {
    const report = await this.prRepo.findOne({ where: { id: reportId } });
    if (!report) return;

    try {
      report.status = PrReportStatus.GENERATING;
      await this.prRepo.save(report);

      const primaryModelId = await this.pickDefaultPrimary();
      const startTime = Date.now();

      const result = await this.llmRouterService.chat({
        primaryModelId,
        fallbackModelIds: [],
        messages: [
          { role: 'system', content: '你是专业的舆情分析师，请根据用户需求生成报告。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 4000,
      });

      report.analysis = result.content;
      report.modelUsed = result.modelUsed;
      report.tokensUsed = result.tokensUsed;
      report.latencyMs = Date.now() - startTime;
      report.status = PrReportStatus.COMPLETED;
      await this.prRepo.save(report);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Template report generation failed: ${msg}`);
      report.status = PrReportStatus.FAILED;
      report.errorMessage = msg;
      await this.prRepo.save(report);
    }
  }

  private async pickDefaultPrimary(): Promise<number> {
    const { LlmModelEntity } = await import('../../database/entities');
    const repo = this.prRepo.manager.getRepository(LlmModelEntity);
    const enabled = await repo.findOne({
      where: { isEnabled: 1 } as any,
      order: { id: 'ASC' },
    });
    if (!enabled) {
      throw new BadRequestException('无可用 LLM 模型，请先在模型管理中配置');
    }
    return enabled.id;
  }
}
