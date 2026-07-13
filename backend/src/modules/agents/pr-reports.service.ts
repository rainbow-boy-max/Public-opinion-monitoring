import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PrReportEntity,
  PrReportStatus,
  OpinionEventEntity,
} from '../../database/entities';
import { AgentsService } from './agents.service';
import { LlmRouterService } from './llm-router.service';

const PR_PROMPT = `你是资深公共关系顾问 + 舆情危机处理专家，处理过 100+ 品牌危机事件。

【任务】根据用户输入的舆情事件，按以下结构输出（Markdown 格式）：
## 一、舆情深度分析
- 事件性质 + 当前传播态势 + 关键情绪词 + 可能蔓延方向
## 二、潜在风险评估
- 商业风险 / 品牌风险 / 法律风险 / 社会舆论风险（每个风险给出等级：低/中/高 + 2 句话解释）
## 三、公关应对方案
- **短期（24小时内）行动**：3 条具体动作
- **中期（1周内）行动**：3 条具体动作
- **公开声明话术**：给出 80-150 字的官方声明模板
- **重点沟通对象**：列出 3 类应该主动沟通的群体
## 四、避坑提示
- 列出 3 个绝对不能犯的错误

要求：
1. 站在品牌方角度，给出可立刻执行的方案
2. 涉及平台官方政策请基于常识判断，不确定时建议咨询专业人士
3. 输出语言：中文，专业且有温度`;

@Injectable()
export class PrReportsService {
  private readonly logger = new Logger(PrReportsService.name);

  constructor(
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private llmRouterService: LlmRouterService,
    private agentsService: AgentsService,
  ) {}

  async startReportFromEvent(
    userId: number,
    eventId: number,
    agentId?: number,
  ): Promise<PrReportEntity> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('舆情事件不存在');

    const inputSnapshot = this.buildEventSnapshot(event);

    const report = this.prRepo.create({
      userId,
      eventId,
      agentId: agentId || null,
      inputSnapshot,
      status: PrReportStatus.PENDING,
    });
    const saved = await this.prRepo.save(report);

    setImmediate(() => {
      this.generateReport(saved.id, inputSnapshot, agentId).catch((err) =>
        this.logger.error(`PR report failed: ${(err as Error).message}`),
      );
    });

    return saved;
  }

  async startReportFromText(
    userId: number,
    text: string,
    title: string,
    agentId?: number,
  ): Promise<PrReportEntity> {
    const inputSnapshot = `自定义舆情内容\n# ${title}\n${text}`;

    const report = this.prRepo.create({
      userId,
      eventId: null,
      agentId: agentId || null,
      inputSnapshot,
      status: PrReportStatus.PENDING,
    });
    const saved = await this.prRepo.save(report);

    setImmediate(() => {
      this.generateReport(saved.id, inputSnapshot, agentId).catch((err) =>
        this.logger.error(`PR report failed: ${(err as Error).message}`),
      );
    });

    return saved;
  }

  async getReport(id: number, userId: number): Promise<PrReportEntity> {
    const r = await this.prRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('报告不存在');
    return r;
  }

  async listReports(
    userId: number,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: PrReportEntity[]; total: number; page: number; pageSize: number }> {
    const [items, total] = await this.prRepo.findAndCount({
      where: { userId },
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  private buildEventSnapshot(event: OpinionEventEntity): string {
    return [
      `# 舆情事件详情`,
      `- 平台: ${event.platform}`,
      `- 标题: ${event.title}`,
      `- 作者: ${event.author}`,
      `- 原文链接: ${event.url}`,
      `- 发布日期: ${new Date(event.publishTime).toLocaleString('zh-CN')}`,
      `- 传播数据: 阅读 ${event.readCount} / 点赞 ${event.likeCount} / 评论 ${event.commentCount} / 转发 ${event.shareCount}`,
      `- 情感倾向: ${event.sentiment === 'positive' ? '正面' : event.sentiment === 'negative' ? '负面' : '中性'}`,
      `- 命中关键词: ${(event.matchedKeywords || []).join(', ')}`,
      ``,
      `## 内容摘要`,
      event.summary || event.content?.substring(0, 500) || '(无内容摘要)',
      ``,
      `## 完整内容`,
      event.content || '(无内容)',
    ].join('\n');
  }

  private async generateReport(
    reportId: number,
    inputSnapshot: string,
    agentId?: number,
  ): Promise<void> {
    const report = await this.prRepo.findOne({ where: { id: reportId } });
    if (!report) return;

    try {
      report.status = PrReportStatus.GENERATING;
      await this.prRepo.save(report);

      let primaryModelId: number | undefined = agentId;
      let fallbackIds: number[] = [];
      let systemPrompt: string = PR_PROMPT;
      let temperature = 0.7;
      let maxTokens = 3000;

      if (agentId) {
        const agent = await this.agentsService.getOne(agentId);
        primaryModelId = agent.primaryModelId;
        fallbackIds = agent.fallbackModelIds || [];
        systemPrompt = `${agent.systemPrompt || ''}\n\n${PR_PROMPT}`;
        temperature = agent.temperature;
        maxTokens = agent.maxTokens;
      }

      if (!primaryModelId) {
        primaryModelId = await this.pickDefaultPrimary();
      }

      const startTime = Date.now();
      const result = await this.llmRouterService.chat({
        primaryModelId,
        fallbackModelIds: fallbackIds,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inputSnapshot },
        ],
        temperature,
        maxTokens,
      });

      const fullText = result.content;
      const analysisEnd = fullText.indexOf('## 二、');
      const analysis = analysisEnd > 0 ? fullText.substring(0, analysisEnd).trim() : '';

      const reportResult = this.parsePrReport(fullText);

      report.analysis = reportResult.analysis;
      report.strategy = reportResult.strategy;
      report.modelUsed = result.modelUsed;
      report.tokensUsed = result.tokensUsed;
      report.latencyMs = Date.now() - startTime;
      report.status = PrReportStatus.COMPLETED;
      await this.prRepo.save(report);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`PR generation failed: ${msg}`);
      report.status = PrReportStatus.FAILED;
      report.errorMessage = msg;
      await this.prRepo.save(report);
    }
  }

  private parsePrReport(fullText: string): { analysis: string; strategy: string } {
    const sections = fullText.split(/^## /gm).filter((s) => s.trim());
    let analysis = '';
    let strategy = '';
    for (const s of sections) {
      const lines = s.split('\n');
      const title = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();
      if (title.includes('一、') || title.includes('深度分析')) {
        analysis = `## ${title}\n${body}`;
      } else if (
        title.includes('二、') ||
        title.includes('三、') ||
        title.includes('四、') ||
        title.includes('风险评估') ||
        title.includes('应对方案') ||
        title.includes('避坑')
      ) {
        strategy = strategy ? `${strategy}\n\n## ${title}\n${body}` : `## ${title}\n${body}`;
      }
    }
    if (!analysis || !strategy) {
      strategy = fullText;
    }
    return { analysis, strategy };
  }

  private async pickDefaultPrimary(): Promise<number> {
    const { LlmModelEntity } = await import('../../database/entities');
    const repo = (this.prRepo.manager.getRepository(LlmModelEntity));
    const enabled = await repo.findOne({
      where: { isEnabled: 1 },
      order: { id: 'ASC' },
    });
    if (!enabled) {
      throw new BadRequestException('无可用 LLM 模型，请先在模型管理中配置');
    }
    return enabled.id;
  }
}
