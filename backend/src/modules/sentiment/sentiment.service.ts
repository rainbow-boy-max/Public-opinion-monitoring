import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmRouterService } from '../agents/llm-router.service';
import { OpinionEventEntity } from '../../database/entities';
import type { ChatMessage } from '../agents/llm.service';

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  aspects?: Array<{
    aspect: string;
    sentiment: string;
    score: number;
  }>;
  reasoning?: string;
  source: 'rule' | 'llm' | 'merged';
}

@Injectable()
export class SentimentAnalysisService {
  private readonly logger = new Logger(SentimentAnalysisService.name);

  private readonly positiveWords = [
    '优秀', '好评', '满意', '推荐', '喜欢', '赞', '支持', '好用', '方便',
    '实惠', '创新', '领先', '突破', '出色', '出色', '很棒', '不错', '惊喜',
    '良心', '踏实', '专业', '高效', '靠谱', '极好', '超值', '信赖',
  ];

  private readonly negativeWords = [
    '差评', '垃圾', '投诉', '退款', '维权', '曝光', '欺诈', '坑', '恶心',
    '愤怒', '危险', '损失', '事故', '故障', '差劲', '糟糕', '失望', '烂',
    '后悔', '痛心', '黑心', '侵权', '造假', '粗制滥造', '客服差',
  ];

  private readonly negateWords = ['不', '没', '无', '非', '莫', '别', '未曾'];

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private llmRouterService: LlmRouterService,
  ) {}

  async analyze(
    text: string,
    options?: {
      aspect?: string;
      detailed?: boolean;
    },
  ): Promise<SentimentResult> {
    const ruleResult = this.ruleBasedAnalysis(text);

    if (ruleResult.confidence < 0.7 || ruleResult.sentiment === 'neutral') {
      try {
        const llmResult = await this.llmAnalysis(text, options);
        return this.mergeResults(ruleResult, llmResult);
      } catch (err) {
        this.logger.warn(`LLM sentiment analysis failed, using rule result: ${err}`);
        return { ...ruleResult, source: 'rule' };
      }
    }

    return ruleResult;
  }

  async analyzeBatch(
    events: Array<{ id: number; title: string; content: string }>,
  ): Promise<Array<{ id: number; sentiment: SentimentResult }>> {
    if (events.length === 0) return [];

    try {
      const combinedText = events
        .map((e, i) => `[事件 ${i + 1}] 标题: ${e.title}\n内容: ${e.content.substring(0, 500)}`)
        .join('\n\n---\n\n');

      const prompt = `你是一个专业的舆情情感分析专家。请分析以下 ${events.length} 条舆情事件的情感倾向。

对每条事件严格按以下 JSON 格式输出：
{
  "results": [
    {
      "index": 1,
      "sentiment": "positive|negative|neutral",
      "score": 0.5,
      "confidence": 0.9,
      "reasoning": "简要分析理由"
    }
  ]
}

评分标准：
- sentiment: positive（正面）, negative（负面）, neutral（中性）
- score: -1 到 1，-1 最负面，0 中性，1 最正面
- confidence: 0 到 1，置信度

待分析事件：
${combinedText}`;

      const messages: ChatMessage[] = [
        { role: 'system', content: '你是舆情分析专家，严格返回 JSON。' },
        { role: 'user', content: prompt },
      ];

      const result = await this.llmRouterService.chat({
        primaryModelId: 0,
        fallbackModelIds: [],
        messages,
        temperature: 0.3,
        maxTokens: 2000,
      });

      const parsed = this.tryParseJson(result.content);
      if (parsed && Array.isArray(parsed.results)) {
        return parsed.results.map((r: any) => {
          const idx = r.index - 1;
          const event = events[idx];
          if (!event) return null;
          const sentiment = ['positive', 'negative', 'neutral'].includes(r.sentiment)
            ? r.sentiment
            : 'neutral';
          return {
            id: event.id,
            sentiment: {
              sentiment,
              score: Math.max(-1, Math.min(1, r.score || 0)),
              confidence: Math.max(0, Math.min(1, r.confidence || 0)),
              reasoning: r.reasoning || '',
              source: 'llm' as const,
            },
          };
        }).filter(Boolean) as Array<{ id: number; sentiment: SentimentResult }>;
      }
    } catch (err) {
      this.logger.warn(`Batch LLM analysis failed, falling back to individual rule: ${err}`);
    }

    return events.map((e) => {
      const text = `${e.title} ${e.content}`;
      return { id: e.id, sentiment: this.ruleBasedAnalysis(text) };
    });
  }

  private ruleBasedAnalysis(text: string): SentimentResult {
    if (!text || text.trim().length === 0) {
      return { sentiment: 'neutral', score: 0, confidence: 0, source: 'rule' };
    }

    let positiveScore = 0;
    let negativeScore = 0;

    const tokens = this.tokenize(text);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const hasNegation =
        i > 0 && this.negateWords.some((n) => tokens[i - 1].includes(n));

      if (this.positiveWords.some((w) => token.includes(w))) {
        positiveScore += hasNegation ? -1 : 1;
      }
      if (this.negativeWords.some((w) => token.includes(w))) {
        negativeScore += hasNegation ? -1 : 1;
      }
    }

    const total = positiveScore + Math.abs(negativeScore);
    let sentiment: 'positive' | 'negative' | 'neutral';
    let score: number;
    let confidence: number;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      score = total > 0 ? positiveScore / total : 0;
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      score = total > 0 ? -negativeScore / total : 0;
    } else {
      sentiment = 'neutral';
      score = 0;
    }

    const magnitude = Math.abs(positiveScore - negativeScore);
    const wordCount = tokens.length;
    confidence = wordCount > 0 ? Math.min(1, magnitude / Math.max(1, wordCount * 0.1)) : 0;

    return { sentiment, score, confidence, source: 'rule' };
  }

  private async llmAnalysis(
    text: string,
    options?: { aspect?: string; detailed?: boolean },
  ): Promise<SentimentResult> {
    const aspectInstruction = options?.aspect
      ? `请重点关注「${options.aspect}」方面的情感倾向。`
      : '';

    const detailedInstruction = options?.detailed
      ? ' 同时输出 aspects 数组（每个方面情感）和 reasoning（分析理由）。'
      : ' 只需输出 sentiment、score、confidence，可附带简要 reasoning。';

    const prompt = `你是一个专业的舆情情感分析专家。请分析以下文本的情感倾向，输出JSON格式：
{
  "sentiment": "positive|negative|neutral",
  "score": -1 to 1,
  "confidence": 0 to 1
  ${options?.detailed ? ',"aspects": [{"aspect": "方面名", "sentiment": "positive|negative|neutral", "score": 0.5}],"reasoning": "分析理由"' : ',"reasoning": "简要理由"'}
}

要求：
- sentiment: positive（正面）, negative（负面）, neutral（中性）
- score: -1 到 1，-1 最负面，0 中性，1 最正面
- confidence: 0 到 1，置信度
${aspectInstruction}
${detailedInstruction}

文本：
${text.substring(0, 2000)}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是舆情分析专家，严格返回 JSON。' },
      { role: 'user', content: prompt },
    ];

    const result = await this.llmRouterService.chat({
      primaryModelId: 0,
      fallbackModelIds: [],
      messages,
      temperature: 0.3,
      maxTokens: 1000,
    });

    const parsed = this.tryParseJson(result.content);
    if (parsed && typeof parsed.sentiment === 'string') {
      const s = parsed.sentiment as string;
      const sentiment = ['positive', 'negative', 'neutral'].includes(s)
        ? (s as 'positive' | 'negative' | 'neutral')
        : 'neutral';
      return {
        sentiment,
        score: Math.max(-1, Math.min(1, (parsed.score as number) || 0)),
        confidence: Math.max(0, Math.min(1, (parsed.confidence as number) || 0)),
        aspects: Array.isArray(parsed.aspects) ? (parsed.aspects as SentimentResult['aspects']) : undefined,
        reasoning: (parsed.reasoning as string) || '',
        source: 'llm',
      };
    }

    throw new Error('Failed to parse LLM response');
  }

  private mergeResults(rule: SentimentResult, llm: SentimentResult): SentimentResult {
    const agree = rule.sentiment === llm.sentiment;

    if (agree) {
      const mergedScore = rule.score * 0.3 + llm.score * 0.7;
      const mergedConfidence = Math.min(1, rule.confidence * 0.3 + llm.confidence * 0.7 + 0.15);
      return {
        sentiment: llm.sentiment,
        score: mergedScore,
        confidence: mergedConfidence,
        aspects: llm.aspects || rule.aspects,
        reasoning: llm.reasoning || rule.reasoning,
        source: 'merged',
      };
    }

    if (llm.confidence > 0.8) {
      return {
        ...llm,
        confidence: llm.confidence * 0.85,
        source: 'merged',
      };
    }

    return {
      sentiment: 'neutral',
      score: 0,
      confidence: Math.max(rule.confidence, llm.confidence) * 0.5,
      aspects: llm.aspects || rule.aspects,
      reasoning: `Rule: ${rule.sentiment}(${rule.score.toFixed(2)}) | LLM: ${llm.sentiment}(${llm.score.toFixed(2)}) — conflict, fallback to neutral`,
      source: 'merged',
    };
  }

  async reanalyzeEvent(eventId: number): Promise<{ id: number; sentiment: SentimentResult }> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');

    const text = `${event.title} ${event.content}`;
    const result = await this.analyze(text, { detailed: true });

    await this.eventRepo.update(eventId, {
      sentiment: result.sentiment as any,
      sentimentScore: result.score,
      sentimentConfidence: result.confidence,
      sentimentSource: result.source,
    } as any);

    return { id: eventId, sentiment: result };
  }

  async reanalyzeTaskEvents(taskId: number): Promise<{ total: number; updated: number }> {
    const events = await this.eventRepo.find({ where: { taskId: taskId as any } });
    let updated = 0;

    for (const event of events) {
      try {
        const text = `${event.title} ${event.content}`;
        const result = await this.analyze(text, { detailed: true });

        await this.eventRepo.update(event.id, {
          sentiment: result.sentiment as any,
          sentimentScore: result.score,
          sentimentConfidence: result.confidence,
          sentimentSource: result.source,
        } as any);
        updated++;
      } catch (err) {
        this.logger.warn(`Reanalyze event ${event.id} failed: ${err}`);
      }
    }

    return { total: events.length, updated };
  }

  async getStats(): Promise<{
    totalAnalyzed: number;
    positive: number;
    negative: number;
    neutral: number;
    avgConfidence: number;
    sourceDistribution: Record<string, number>;
  }> {
    const events = await this.eventRepo.find({ select: ['sentiment', 'sentimentConfidence', 'sentimentSource'] });

    const stats = {
      totalAnalyzed: events.length,
      positive: 0,
      negative: 0,
      neutral: 0,
      avgConfidence: 0,
      sourceDistribution: {} as Record<string, number>,
    };

    let totalConf = 0;
    let confCount = 0;

    for (const e of events) {
      if (e.sentiment === 'positive') stats.positive++;
      else if (e.sentiment === 'negative') stats.negative++;
      else stats.neutral++;

      if (e.sentimentConfidence !== null) {
        totalConf += e.sentimentConfidence;
        confCount++;
      }

      const src = e.sentimentSource || 'rule';
      stats.sourceDistribution[src] = (stats.sourceDistribution[src] || 0) + 1;
    }

    stats.avgConfidence = confCount > 0 ? totalConf / confCount : 0;

    return stats;
  }

  private tokenize(text: string): string[] {
    const cleaned = text.replace(/[^\u4e00-\u9fff\w]/g, ' ');
    return cleaned.split(/\s+/).filter(Boolean);
  }

  private tryParseJson(content: string): Record<string, unknown> | null {
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) return null;
      return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch {
      return null;
    }
  }
}
