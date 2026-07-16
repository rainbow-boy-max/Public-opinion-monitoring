import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, MoreThanOrEqual, Like } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PrReportEntity,
  PrReportStatus,
  OpinionEventEntity,
  ReportScheduleEntity,
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

const PERIODIC_PROMPT = `你是资深公共关系顾问 + 舆情数据分析专家，处理过 100+ 品牌舆情事件。

【任务】根据以下某时间段内的聚合舆情数据，按以下结构输出综合性舆情报告（Markdown 格式）：
## 一、整体舆情态势
- 报告期内舆情总览：事件总数、平台分布、情感分布、Top 关键词
- 整体趋势判断（上升/平稳/回落）
## 二、重点事件分析
- 按互动量排序的 Top 事件列表（标题、平台、情感、互动数据）
- 各重点事件的性质与影响
## 三、风险预警
- 当前已识别的高/中/低风险事件及理由
- 需要立即关注的热点趋势
## 四、综合建议
- 针对性的公关行动建议
- 下阶段关键词监控建议

要求：
1. 站在品牌管理角度，数据驱动分析
2. 输出语言：中文，专业精炼
3. 如数据不足，请如实说明`;

@Injectable()
export class PrReportsService {
  private readonly logger = new Logger(PrReportsService.name);

  constructor(
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(ReportScheduleEntity)
    private scheduleRepo: Repository<ReportScheduleEntity>,
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

  async adminList(
    page = 1,
    pageSize = 20,
    filters?: { status?: string; search?: string },
  ): Promise<{ items: PrReportEntity[]; total: number; page: number; pageSize: number }> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.title = Like(`%${filters.search}%`);
    }
    const [items, total] = await this.prRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['user'],
    });
    return { items, total, page, pageSize };
  }

  async adminDelete(id: number): Promise<void> {
    const report = await this.prRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('报告不存在');
    await this.prRepo.remove(report);
  }

  // P1-04: periodic report generation
  async generatePeriodicReport(
    userId: number,
    freq: 'daily' | 'weekly',
    taskIds: number[],
  ): Promise<PrReportEntity> {
    const timeRange = freq === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - timeRange);

    const events = await this.eventRepo.find({
      where: {
        taskId: In(taskIds),
        matchedAt: MoreThanOrEqual(since),
      },
      order: { matchedAt: 'DESC' },
    });

    const periodicConfig = JSON.stringify({ taskIds, timeRange: `${freq}`, includeCharts: false });

    const inputSnapshot = this.buildPeriodicSnapshot(events, freq);
    const report = this.prRepo.create({
      userId,
      eventId: null,
      agentId: null,
      inputSnapshot,
      status: PrReportStatus.PENDING,
      reportType: 'periodic',
      periodicFreq: freq,
      periodicConfig,
      exportFormat: 'markdown',
    });
    const saved = await this.prRepo.save(report);

    setImmediate(() => {
      this.generatePeriodicContent(saved.id, inputSnapshot).catch((err) =>
        this.logger.error(`Periodic PR report failed: ${(err as Error).message}`),
      );
    });

    return saved;
  }

  async getPeriodicReportPreview(
    userId: number,
    freq: 'daily' | 'weekly',
    taskIds: number[],
  ): Promise<{ preview: string; eventCount: number }> {
    const timeRange = freq === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - timeRange);

    const events = await this.eventRepo.find({
      where: {
        taskId: In(taskIds),
        matchedAt: MoreThanOrEqual(since),
      },
      order: { matchedAt: 'DESC' },
    });

    const snapshot = this.buildPeriodicSnapshot(events, freq);
    return { preview: snapshot, eventCount: events.length };
  }

  async exportReport(
    id: number,
    userId: number,
    format: 'markdown' | 'pdf' | 'docx',
  ): Promise<{ content: string; filename: string; contentType: string }> {
    const report = await this.getReport(id, userId);
    if (report.status !== PrReportStatus.COMPLETED) {
      throw new BadRequestException('报告尚未完成，无法导出');
    }

    const fullContent = [report.analysis, report.strategy]
      .filter(Boolean)
      .join('\n\n');

    if (format === 'pdf' || format === 'docx') {
      this.logger.warn(`${format} export requested, falling back to markdown`);
    }

    const filename = `pr-report-${id}-${Date.now()}.md`;
    report.exportFormat = format;
    report.exportUrl = `/pr/reports/${id}/export/markdown`;
    await this.prRepo.save(report);

    return {
      content: fullContent,
      filename,
      contentType: 'text/markdown; charset=utf-8',
    };
  }

  // P1-04: scheduled report management
  async createSchedule(
    userId: number,
    data: {
      name: string;
      freq: 'daily' | 'weekly';
      taskIds: number[];
      time: string;
    },
  ): Promise<ReportScheduleEntity> {
    const nextRunAt = this.calcNextRun(data.freq, data.time);
    const schedule = this.scheduleRepo.create({
      userId,
      name: data.name,
      freq: data.freq,
      taskIds: JSON.stringify(data.taskIds),
      time: data.time,
      nextRunAt,
      isActive: 1,
    });
    return this.scheduleRepo.save(schedule);
  }

  async listSchedules(userId: number): Promise<ReportScheduleEntity[]> {
    return this.scheduleRepo.find({
      where: { userId },
      order: { id: 'DESC' },
    });
  }

  async deleteSchedule(userId: number, id: number): Promise<void> {
    const s = await this.scheduleRepo.findOne({ where: { id, userId } });
    if (!s) throw new NotFoundException('订阅不存在');
    await this.scheduleRepo.remove(s);
  }

  async toggleSchedule(userId: number, id: number): Promise<ReportScheduleEntity> {
    const s = await this.scheduleRepo.findOne({ where: { id, userId } });
    if (!s) throw new NotFoundException('订阅不存在');
    s.isActive = s.isActive ? 0 : 1;
    if (s.isActive) {
      s.nextRunAt = this.calcNextRun(s.freq, s.time);
    } else {
      s.nextRunAt = null;
    }
    return this.scheduleRepo.save(s);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkScheduledReports(): Promise<void> {
    const now = new Date();
    const due = await this.scheduleRepo.find({
      where: {
        isActive: 1,
        nextRunAt: LessThan(now),
      },
    });

    for (const s of due) {
      try {
        let taskIds: number[];
        try {
          taskIds = JSON.parse(s.taskIds);
        } catch {
          taskIds = [];
        }
        if (taskIds.length === 0) continue;

        this.logger.log(`Running scheduled report: ${s.name} (${s.freq})`);
        await this.generatePeriodicReport(s.userId, s.freq, taskIds);

        s.nextRunAt = this.calcNextRun(s.freq, s.time);
        await this.scheduleRepo.save(s);
      } catch (err) {
        this.logger.error(`Scheduled report "${s.name}" failed: ${(err as Error).message}`);
      }
    }
  }

  private calcNextRun(freq: 'daily' | 'weekly', time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    let next = new Date(now);
    next.setHours(h, m, 0, 0);

    if (next <= now) {
      if (freq === 'daily') {
        next.setDate(next.getDate() + 1);
      } else {
        next.setDate(next.getDate() + (7 - next.getDay() + 1) % 7 || 7);
      }
    } else if (freq === 'weekly' && next.getDay() !== 1) {
      next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7));
    }

    return next;
  }

  private buildPeriodicSnapshot(events: OpinionEventEntity[], freq: 'daily' | 'weekly'): string {
    if (events.length === 0) {
      return `# ${freq === 'daily' ? '日报' : '周报'}舆情报告\n\n报告期内无新增舆情事件。`;
    }

    const total = events.length;
    const platformBreakdown: Record<string, number> = {};
    const sentimentDist: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
    const keywordCount: Record<string, number> = {};
    const sortedByEngagement = [...events].sort(
      (a, b) => (b.readCount + b.likeCount + b.commentCount + b.shareCount) -
                   (a.readCount + a.likeCount + a.commentCount + a.shareCount),
    );

    for (const e of events) {
      platformBreakdown[e.platform] = (platformBreakdown[e.platform] || 0) + 1;
      sentimentDist[e.sentiment] = (sentimentDist[e.sentiment] || 0) + 1;
      for (const kw of e.matchedKeywords || []) {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      }
    }

    const topKeywords = Object.entries(keywordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topEvents = sortedByEngagement.slice(0, 10);

    const periodLabel = freq === 'daily' ? '过去 24 小时' : '过去 7 天';

    const lines: string[] = [
      `# ${freq === 'daily' ? '日报' : '周报'}舆情报告`,
      `- 报告周期：${periodLabel}`,
      `- 生成时间：${new Date().toLocaleString('zh-CN')}`,
      '',
      '## 数据概览',
      `- 事件总数：${total}`,
      '',
      '### 平台分布',
      ...Object.entries(platformBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([p, c]) => `- ${p}: ${c} 条`),
      '',
      '### 情感分布',
      `- 正面: ${sentimentDist.positive} 条`,
      `- 负面: ${sentimentDist.negative} 条`,
      `- 中性: ${sentimentDist.neutral} 条`,
      '',
      '### Top 关键词',
      ...topKeywords.map(([kw, c]) => `- ${kw}: ${c} 次`),
      '',
      '### Top 事件（按互动量）',
      ...topEvents.map((e, i) =>
        `${i + 1}. [${e.platform}] ${e.title} (阅读:${e.readCount} 点赞:${e.likeCount} 评论:${e.commentCount}) - ${e.sentiment === 'positive' ? '正面' : e.sentiment === 'negative' ? '负面' : '中性'}`,
      ),
    ];

    return lines.join('\n');
  }

  private async generatePeriodicContent(
    reportId: number,
    inputSnapshot: string,
  ): Promise<void> {
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
          { role: 'system', content: PERIODIC_PROMPT },
          { role: 'user', content: inputSnapshot },
        ],
        temperature: 0.7,
        maxTokens: 4000,
      });

      const fullText = result.content;
      const sections = fullText.split(/^## /gm).filter((s) => s.trim());
      let analysis = '';
      let strategy = '';

      for (const s of sections) {
        const lines = s.split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        if (title.includes('一、') || title.includes('整体舆情')) {
          analysis = `## ${title}\n${body}`;
        } else {
          strategy = strategy ? `${strategy}\n\n## ${title}\n${body}` : `## ${title}\n${body}`;
        }
      }

      if (!analysis) analysis = fullText;

      report.analysis = analysis;
      report.strategy = strategy;
      report.modelUsed = result.modelUsed;
      report.tokensUsed = result.tokensUsed;
      report.latencyMs = Date.now() - startTime;
      report.status = PrReportStatus.COMPLETED;
      await this.prRepo.save(report);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Periodic PR generation failed: ${msg}`);
      report.status = PrReportStatus.FAILED;
      report.errorMessage = msg;
      await this.prRepo.save(report);
    }
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
