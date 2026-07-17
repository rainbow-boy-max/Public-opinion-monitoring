import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import {
  OpinionEventEntity,
  PrReportEntity,
  PrReportStatus,
  MonitorTaskEntity,
  PropagationLinkEntity,
} from '../../database/entities';
import { LlmRouterService } from './llm-router.service';

interface AnalyzedIntent {
  keywords: string[];
  timeRange: { start: Date; end: Date };
  platforms: string[];
  analysisType: 'overview' | 'deep' | 'crisis' | 'trend';
  focus: string;
}

interface EventAnalysis {
  summary: string;
  sentimentTrend: { positive: number; negative: number; neutral: number };
  keyFindings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface PropagationSummary {
  originPlatform: string;
  propagationPath: string[];
  keyNodes: string[];
  speed: string;
}

export interface OrchestrationResult {
  reportId: number;
  title: string;
  summary: string;
  analysis: string;
  strategy: string;
  modelUsed: string;
  tokensUsed: number;
}

interface OrchestrationProgress {
  stage: 'understand' | 'monitor' | 'analyze' | 'track' | 'report' | 'done' | 'failed';
  progress: number;
  message: string;
  reportId?: number;
}

const UNDERSTAND_PROMPT = `你是一个舆情分析系统的意图解析器。分析用户输入，提取以下信息并以 JSON 格式返回：

{
  "keywords": ["关键词数组"],
  "timeRange": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
  "platforms": ["平台数组，如weibo、weixin、douyin、xiaohongshu"],
  "analysisType": "overview|deep|crisis|trend",
  "focus": "分析重点描述"
}

规则：
- timeRange：如果用户未指定时间范围，start 设为 7 天前，end 设为今天
- platforms：如果用户未指定平台，返回空数组表示全部
- analysisType：根据意图判断类型
- keywords：提取核心关键词，最多 10 个
- focus：一句话概括分析重点`;

const ANALYZE_PROMPT = `你是一个资深舆情分析师。根据以下舆情事件数据，进行分析并以 JSON 格式返回：

{
  "summary": "整体分析摘要",
  "sentimentTrend": {"positive": 0, "negative": 0, "neutral": 0},
  "keyFindings": ["发现1", "发现2", "发现3"],
  "riskLevel": "low|medium|high|critical"
}

要求：基于事件标题、内容、情感、平台分布进行专业分析。`;

const REPORT_PROMPT = `你是一个资深公共关系顾问 + 舆情危机处理专家。

【任务】根据以下分析结果，生成完整的公关报告，使用 Markdown 格式：

## 一、舆情深度分析
- 事件性质 + 传播态势 + 关键情绪词 + 可能蔓延方向

## 二、潜在风险评估
- 商业风险 / 品牌风险 / 法律风险 / 社会舆论风险

## 三、公关应对方案
- 短期（24小时内）行动：3 条具体动作
- 中期（1周内）行动：3 条具体动作
- 公开声明话术：80-150 字的官方声明模板

## 四、避坑提示
- 3 个绝对不能犯的错误

要求：专业、可执行、中文输出。`;

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private llmRouterService: LlmRouterService,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(PrReportEntity)
    private reportRepo: Repository<PrReportEntity>,
    @InjectRepository(PropagationLinkEntity)
    private propagationRepo: Repository<PropagationLinkEntity>,
  ) {}

  async orchestrate(
    userId: number,
    query: string,
    onProgress?: (progress: OrchestrationProgress) => void,
  ): Promise<OrchestrationResult> {
    const report = this.reportRepo.create({
      userId,
      inputSnapshot: query,
      status: PrReportStatus.PENDING,
      reportType: 'multi',
    });
    const saved = await this.reportRepo.save(report);
    const reportId = saved.id;

    try {
      this.emitProgress(onProgress, 'understand', 10, '正在理解分析需求...');
      const intent = await this.understandQuery(query);

      this.emitProgress(onProgress, 'monitor', 30, '正在搜索舆情事件...');
      const events = await this.monitorEvents(userId, intent);

      this.emitProgress(onProgress, 'analyze', 50, '正在分析事件数据...');
      const analysis = await this.analyzeEvents(events, intent);

      this.emitProgress(onProgress, 'track', 70, '正在追踪传播路径...');
      const propagation = await this.trackPropagation(events);

      this.emitProgress(onProgress, 'report', 85, '正在生成综合报告...');
      const result = await this.generateReport(
        reportId,
        intent,
        analysis,
        propagation,
        query,
      );

      this.emitProgress(onProgress, 'done', 100, '报告生成完成', reportId);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      this.logger.error(`Orchestration failed: ${msg}`);
      await this.reportRepo.update(reportId, {
        status: PrReportStatus.FAILED,
        errorMessage: msg,
      });
      this.emitProgress(onProgress, 'failed', 0, `分析失败: ${msg}`);
      throw new BadRequestException(`分析失败: ${msg}`);
    }
  }

  async getReport(reportId: number): Promise<PrReportEntity> {
    const r = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!r) throw new BadRequestException('报告不存在');
    return r;
  }

  private emitProgress(
    cb: ((p: OrchestrationProgress) => void) | undefined,
    stage: OrchestrationProgress['stage'],
    progress: number,
    message: string,
    reportId?: number,
  ): void {
    if (cb) cb({ stage, progress, message, reportId });
  }

  private async understandQuery(query: string): Promise<AnalyzedIntent> {
    const primaryModelId = await this.pickDefaultPrimary();
    const result = await this.llmRouterService.chat({
      primaryModelId,
      fallbackModelIds: [],
      messages: [
        { role: 'system', content: UNDERSTAND_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.1,
      maxTokens: 1000,
    });

    const raw = result.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new BadRequestException('无法解析分析意图');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        timeRange: {
          start: parsed.timeRange?.start
            ? new Date(parsed.timeRange.start)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: parsed.timeRange?.end ? new Date(parsed.timeRange.end) : new Date(),
        },
        platforms: Array.isArray(parsed.platforms) ? parsed.platforms : [],
        analysisType: parsed.analysisType || 'overview',
        focus: parsed.focus || query,
      };
    } catch {
      throw new BadRequestException('意图解析 JSON 格式错误');
    }
  }

  private async monitorEvents(
    userId: number,
    intent: AnalyzedIntent,
  ): Promise<OpinionEventEntity[]> {
    const qb = this.eventRepo.createQueryBuilder('e');

    if (intent.keywords.length > 0) {
      const conditions = intent.keywords.map((kw, i) => {
        const param = `kw${i}`;
        return `(e.title LIKE :${param} OR e.content LIKE :${param} OR JSON_CONTAINS(e.matched_keywords, :${param}Json))`;
      });
      qb.andWhere(`(${conditions.join(' OR ')})`);
      intent.keywords.forEach((kw, i) => {
        qb.setParameter(`kw${i}`, `%${kw}%`);
        qb.setParameter(`kw${i}Json`, JSON.stringify(kw));
      });
    }

    if (intent.platforms.length > 0) {
      qb.andWhere('e.platform IN (:...platforms)', { platforms: intent.platforms });
    }

    qb.andWhere('e.matched_at >= :start', { start: intent.timeRange.start });
    qb.andWhere('e.matched_at <= :end', { end: intent.timeRange.end });

    qb.orderBy('e.read_count + e.like_count + e.comment_count + e.share_count', 'DESC');
    qb.limit(30);

    return qb.getMany();
  }

  private async analyzeEvents(
    events: OpinionEventEntity[],
    intent: AnalyzedIntent,
  ): Promise<EventAnalysis> {
    if (events.length === 0) {
      return {
        summary: '未找到相关舆情事件，无法进行分析。',
        sentimentTrend: { positive: 0, negative: 0, neutral: 0 },
        keyFindings: ['暂无数据'],
        riskLevel: 'low',
      };
    }

    const snapshot = events
      .map(
        (e, i) =>
          `[${i + 1}] 平台:${e.platform} 标题:${e.title} 情感:${e.sentiment} 阅读:${e.readCount} 评论:${e.commentCount} 摘要:${(e.summary || '').substring(0, 200)}`,
      )
      .join('\n\n');

    const sentimentTrend = {
      positive: events.filter((e) => e.sentiment === 'positive').length,
      negative: events.filter((e) => e.sentiment === 'negative').length,
      neutral: events.filter((e) => e.sentiment === 'neutral').length,
    };

    try {
      const primaryModelId = await this.pickDefaultPrimary();
      const result = await this.llmRouterService.chat({
        primaryModelId,
        fallbackModelIds: [],
        messages: [
          { role: 'system', content: ANALYZE_PROMPT },
          {
            role: 'user',
            content: `分析重点：${intent.focus}\n\n舆情事件数据：\n${snapshot}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const raw = result.content.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '分析完成',
          sentimentTrend: parsed.sentimentTrend || sentimentTrend,
          keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
          riskLevel: parsed.riskLevel || 'medium',
        };
      }
    } catch (err) {
      this.logger.warn(`LLM analysis failed, using fallback: ${(err as Error).message}`);
    }

    return {
      summary: `共发现 ${events.length} 条相关舆情事件，覆盖 ${new Set(events.map((e) => e.platform)).size} 个平台。`,
      sentimentTrend,
      keyFindings: events.slice(0, 5).map((e) => `[${e.platform}] ${e.title}`),
      riskLevel: sentimentTrend.negative > events.length / 2 ? 'high' : 'medium',
    };
  }

  private async trackPropagation(
    events: OpinionEventEntity[],
  ): Promise<PropagationSummary> {
    if (events.length === 0) {
      return {
        originPlatform: '未知',
        propagationPath: [],
        keyNodes: [],
        speed: '无数据',
      };
    }

    const eventIds = events.map((e) => e.id);
    const links = await this.propagationRepo.find({
      where: [
        { sourceEventId: In(eventIds) },
        { targetEventId: In(eventIds) },
      ],
      order: { detectedAt: 'ASC' },
      take: 50,
    });

    const platformSet = new Set(events.map((e) => e.platform));
    const platformList = Array.from(platformSet);
    const platformCount = events.reduce(
      (acc, e) => {
        acc[e.platform] = (acc[e.platform] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const sortedPlatforms = Object.entries(platformCount).sort(
      (a, b) => b[1] - a[1],
    );

    const path: string[] = [];
    if (links.length > 0) {
      for (const link of links) {
        path.push(`${link.sourcePlatform} -> ${link.targetPlatform}`);
      }
    } else if (sortedPlatforms.length > 1) {
      for (let i = 0; i < sortedPlatforms.length - 1; i++) {
        path.push(`${sortedPlatforms[i][0]} -> ${sortedPlatforms[i + 1][0]}`);
      }
    }

    return {
      originPlatform: sortedPlatforms[0]?.[0] || '未知',
      propagationPath: path.length > 0 ? path : ['数据不足以构建传播路径'],
      keyNodes: events
        .filter((e) => e.readCount > 10000 || e.commentCount > 1000)
        .slice(0, 5)
        .map((e) => `[${e.platform}] ${e.author || '未知'}`),
      speed: links.length > 0 ? `${links.length} 条传播链路` : '未检测到明显的跨平台传播',
    };
  }

  private async generateReport(
    reportId: number,
    intent: AnalyzedIntent,
    analysis: EventAnalysis,
    propagation: PropagationSummary,
    originalQuery: string,
  ): Promise<OrchestrationResult> {
    await this.reportRepo.update(reportId, { status: PrReportStatus.GENERATING });

    const context = [
      `## 用户原始需求`,
      originalQuery,
      ``,
      `## 分析意图`,
      `- 关键词: ${intent.keywords.join(', ')}`,
      `- 时间范围: ${intent.timeRange.start.toLocaleDateString('zh-CN')} ~ ${intent.timeRange.end.toLocaleDateString('zh-CN')}`,
      `- 平台: ${intent.platforms.length > 0 ? intent.platforms.join(', ') : '全部平台'}`,
      `- 分析类型: ${intent.analysisType}`,
      `- 分析重点: ${intent.focus}`,
      ``,
      `## 数据分析结果`,
      `- 情感分布: 正面 ${analysis.sentimentTrend.positive} / 负面 ${analysis.sentimentTrend.negative} / 中性 ${analysis.sentimentTrend.neutral}`,
      `- 风险等级: ${analysis.riskLevel}`,
      `- 关键发现:`,
      ...analysis.keyFindings.map((f) => `  - ${f}`),
      ``,
      `## 传播分析`,
      `- 源头平台: ${propagation.originPlatform}`,
      `- 传播路径: ${propagation.propagationPath.join(' -> ')}`,
      `- 关键节点: ${propagation.keyNodes.join(', ')}`,
      `- 传播速度: ${propagation.speed}`,
    ].join('\n');

    const primaryModelId = await this.pickDefaultPrimary();
    const startTime = Date.now();
    const result = await this.llmRouterService.chat({
      primaryModelId,
      fallbackModelIds: [],
      messages: [
        { role: 'system', content: REPORT_PROMPT },
        { role: 'user', content: context },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    });

    const fullText = result.content;
    const analysisEnd = fullText.indexOf('## 二、');
    const analysisSection =
      analysisEnd > 0 ? fullText.substring(0, analysisEnd).trim() : fullText;

    const title = `舆情分析: ${intent.keywords.slice(0, 3).join('/')}`;
    const summary = analysis.summary;

    await this.reportRepo.update(reportId, {
      analysis: analysisSection,
      strategy: fullText,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
      latencyMs: Date.now() - startTime,
      status: PrReportStatus.COMPLETED,
    });

    return {
      reportId,
      title,
      summary,
      analysis: analysisSection,
      strategy: fullText,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
    };
  }

  private async pickDefaultPrimary(): Promise<number> {
    const { LlmModelEntity } = await import('../../database/entities');
    const repo = this.reportRepo.manager.getRepository(LlmModelEntity);
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
