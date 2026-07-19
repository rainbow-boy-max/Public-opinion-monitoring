import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { OpinionEventEntity, CompetitorGroupEntity } from '../../database/entities';

export interface BrandReputationData {
  overview: {
    brandVoice: number;
    shareOfVoice: number;
    npsScore: number;
    sentimentScore: number;
    trend: 'rising' | 'stable' | 'declining';
  };
  sentimentTrend: Array<{ date: string; positive: number; negative: number; neutral: number; nps: number }>;
  platformBreakdown: Array<{ platform: string; mentions: number; sentiment: number }>;
  topKeywords: Array<{ keyword: string; count: number; sentiment: number }>;
  competitorComparison: Array<{
    name: string;
    mentions: number;
    sentimentScore: number;
    shareOfVoice: number;
    trend: string;
  }>;
  recentMentions: Array<{
    id: number; title: string; platform: string; sentiment: string;
    engagement: number; publishedAt: Date; url: string;
  }>;
}

@Injectable()
export class BrandReputationService {
  private readonly logger = new Logger(BrandReputationService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(CompetitorGroupEntity)
    private competitorGroupRepo: Repository<CompetitorGroupEntity>,
  ) {}

  async getReputation(
    userId: number,
    brandKeywords: string[],
    options: { days?: number } = {},
  ): Promise<BrandReputationData & { dataSource: string; lastUpdated: string }> {
    const data = await this.aggregateLiveReputation(userId, brandKeywords, options.days || 30);
    return {
      dataSource: 'live',
      lastUpdated: new Date().toISOString(),
      ...data,
    };
  }

  async getBrandComparison(
    userId: number,
    brandA: string[],
    brandB: string[],
  ): Promise<{ brandA: BrandReputationData; brandB: BrandReputationData }> {
    const [a, b] = await Promise.all([
      this.aggregateLiveReputation(userId, brandA),
      this.aggregateLiveReputation(userId, brandB),
    ]);
    return { brandA: a, brandB: b };
  }

  private async aggregateLiveReputation(
    userId: number,
    brandKeywords: string[],
    days: number = 30,
  ): Promise<BrandReputationData> {
    if (!brandKeywords?.length) {
      return this.emptyReputation();
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.eventRepo.find({
      where: { matchedAt: MoreThanOrEqual(since) },
      order: { matchedAt: 'DESC' },
      take: 10000,
    });
    const normalized = brandKeywords.map((k) => k.toLowerCase());
    const matched = events.filter((e) => {
      const title = (e.title || '').toLowerCase();
      const content = (e.content || '').toLowerCase();
      return normalized.some((k) => title.includes(k) || content.includes(k));
    });
    const total = matched.length;
    if (total === 0) {
      return this.emptyReputation();
    }
    let positive = 0, negative = 0;
    const platformMap: Record<string, { mentions: number; sentiment: number }> = {};
    const keywordMap: Record<string, { count: number; sentiment: number }> = {};
    const dayMap: Record<string, { pos: number; neg: number; neu: number }> = {};
    for (const e of matched) {
      if (e.sentiment === 'positive') positive++;
      else if (e.sentiment === 'negative') negative++;
      else if (e.sentiment !== 'neutral') continue;
      const platform = e.platform || 'unknown';
      const item = platformMap[platform] || { mentions: 0, sentiment: 0 };
      item.mentions++;
      item.sentiment += e.sentiment === 'positive' ? 1 : e.sentiment === 'negative' ? -1 : 0;
      platformMap[platform] = item;
      const keywords = (e.matchedKeywords as string[]) || [];
      for (const kw of keywords) {
        const k = keywordMap[kw] || { count: 0, sentiment: 0 };
        k.count++;
        k.sentiment += e.sentiment === 'positive' ? 1 : e.sentiment === 'negative' ? -1 : 0;
        keywordMap[kw] = k;
      }
      const day = new Date(e.matchedAt).toISOString().slice(0, 10);
      const bucket = dayMap[day] || { pos: 0, neg: 0, neu: 0 };
      if (e.sentiment === 'positive') bucket.pos++;
      else if (e.sentiment === 'negative') bucket.neg++;
      else bucket.neu++;
      dayMap[day] = bucket;
    }
    const sentimentTrend = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        positive: b.pos,
        negative: b.neg,
        neutral: b.neu,
        nps: Math.round(((b.pos - b.neg) / Math.max(1, b.pos + b.neg + b.neu)) * 100),
      }));
    const platformBreakdown = Object.entries(platformMap)
      .map(([platform, v]) => ({
        platform,
        mentions: v.mentions,
        sentiment: v.mentions > 0 ? Math.round((v.sentiment / v.mentions) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);
    const topKeywords = Object.entries(keywordMap)
      .map(([keyword, v]) => ({ keyword, count: v.count, sentiment: v.count > 0 ? Math.round((v.sentiment / v.count) * 100) / 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const totalEvents = await this.eventRepo.count({ where: { matchedAt: MoreThanOrEqual(since) } });
    const shareOfVoice = totalEvents > 0 ? Math.round((total / totalEvents) * 10000) / 100 : 0;
    const npsScore = total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;
    const sentimentScore = total > 0 ? Math.round(((positive - negative) / total) * 100) / 100 : 0;
    const trend: 'rising' | 'stable' | 'declining' = npsScore > 5 ? 'rising' : npsScore < -5 ? 'declining' : 'stable';
    return {
      overview: {
        brandVoice: total,
        shareOfVoice,
        npsScore,
        sentimentScore,
        trend,
      },
      sentimentTrend,
      platformBreakdown,
      topKeywords,
      competitorComparison: [],
      recentMentions: matched.slice(0, 10).map((e) => ({
        id: e.id,
        title: e.title,
        platform: e.platform,
        sentiment: e.sentiment,
        engagement: (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0),
        publishedAt: e.matchedAt,
        url: '',
      })),
    };
  }

  private emptyReputation(): BrandReputationData {
    return {
      overview: { brandVoice: 0, shareOfVoice: 0, npsScore: 0, sentimentScore: 0, trend: 'stable' },
      sentimentTrend: [],
      platformBreakdown: [],
      topKeywords: [],
      competitorComparison: [],
      recentMentions: [],
    };
  }

  async getLegacyReputation(options?: { days?: number }): Promise<BrandReputationData> {
    const days = options?.days || 30;
    const now = Date.now();
    const day = 86400000;

    const sentimentTrend: BrandReputationData['sentimentTrend'] = [];
    let cumPos = 0, cumNeg = 0, cumNeu = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now - (days - 1 - i) * day);
      const date = d.toISOString().slice(0, 10);
      const pos = Math.round(80 + Math.random() * 120 + i * 2);
      const neg = Math.round(30 + Math.random() * 60 - i * 0.5);
      const neu = Math.round(40 + Math.random() * 80);
      cumPos += pos; cumNeg += neg; cumNeu += neu;
      const nps = Math.round(((pos - neg) / (pos + neg + neu)) * 100);
      sentimentTrend.push({ date, positive: pos, negative: neg, neutral: neu, nps });
    }

    const totalBrand = cumPos + cumNeg + cumNeu;
    const npsScore = totalBrand > 0 ? Math.round(((cumPos - cumNeg) / totalBrand) * 100) : 0;
    const shareOfVoice = 42;

    const platforms = [
      { platform: 'weibo', mentions: 980, sentiment: 0.32 },
      { platform: 'weixin', mentions: 654, sentiment: 0.45 },
      { platform: 'douyin', mentions: 523, sentiment: -0.12 },
      { platform: 'xiaohongshu', mentions: 412, sentiment: 0.28 },
      { platform: 'kuaishou', mentions: 298, sentiment: 0.15 },
      { platform: 'baijiahao', mentions: 278, sentiment: 0.52 },
    ];

    const topKeywords = [
      { keyword: '新品发布', count: 423, sentiment: 0.65 },
      { keyword: '用户体验', count: 312, sentiment: 0.42 },
      { keyword: '价格争议', count: 267, sentiment: -0.38 },
      { keyword: '技术突破', count: 198, sentiment: 0.72 },
      { keyword: '市场份额', count: 156, sentiment: 0.18 },
      { keyword: '售后服务', count: 134, sentiment: -0.22 },
      { keyword: '品牌升级', count: 112, sentiment: 0.55 },
      { keyword: '用户好评', count: 98, sentiment: 0.81 },
    ];

    const competitorComparison = [
      { name: '竞品A', mentions: 2847, sentimentScore: 12, shareOfVoice: 35, trend: 'stable' },
      { name: '竞品B', mentions: 2135, sentimentScore: -36, shareOfVoice: 26, trend: 'declining' },
      { name: '竞品C', mentions: 1689, sentimentScore: 45, shareOfVoice: 21, trend: 'rising' },
      { name: '竞品D', mentions: 1456, sentimentScore: 13, shareOfVoice: 18, trend: 'stable' },
    ];

    const recentMentions = Array.from({ length: 10 }, (_, i) => ({
      id: 10000 + i,
      title: ['品牌A新品发布会引发行业热议', '品牌A用户体验深度评测报告', '品牌A价格策略调整引争议',
        '品牌A荣获年度创新大奖', '品牌A公益项目获社会各界好评', '品牌A技术突破引领行业发展',
        '品牌A用户满意度调查结果出炉', '品牌A与知名IP联名合作官宣', '品牌A海外市场拓展新进展',
        '品牌A回应产品质量质疑'][i],
      platform: ['weibo', 'weixin', 'douyin', 'xiaohongshu', 'baijiahao', 'weibo', 'kuaishou', 'weixin', 'douyin', 'xiaohongshu'][i],
      sentiment: ['positive', 'neutral', 'negative', 'positive', 'positive', 'positive', 'neutral', 'positive', 'neutral', 'negative'][i],
      engagement: [45200, 32100, 28700, 18900, 15600, 14200, 12800, 11500, 9800, 8700][i],
      publishedAt: new Date(now - i * day * 0.5),
      url: '#',
    }));

    return {
      overview: {
        brandVoice: totalBrand,
        shareOfVoice,
        npsScore,
        sentimentScore: Math.round(((cumPos * 0.6 + cumNeg * (-0.4) + cumNeu * 0) / totalBrand) * 100) / 100,
        trend: npsScore > 5 ? 'rising' : npsScore < -5 ? 'declining' : 'stable',
      },
      sentimentTrend,
      platformBreakdown: platforms,
      topKeywords,
      competitorComparison,
      recentMentions,
    };
  }

  private calcTrend(npsScore: number): 'rising' | 'stable' | 'declining' {
    if (npsScore > 5) return 'rising';
    if (npsScore < -5) return 'declining';
    return 'stable';
  }

  private buildSentimentTrend(
    events: OpinionEventEntity[],
    start: Date,
    end: Date,
  ): Array<{ date: string; positive: number; negative: number; neutral: number; nps: number }> {
    const dayMap = new Map<string, { positive: number; negative: number; neutral: number }>();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { positive: 0, negative: 0, neutral: 0 });
    }
    events.forEach((e) => {
      const key = new Date(e.matchedAt).toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) {
        if (e.sentiment === 'positive') entry.positive++;
        else if (e.sentiment === 'negative') entry.negative++;
        else entry.neutral++;
      }
    });
    return [...dayMap.entries()].map(([date, v]) => {
      const total = v.positive + v.negative + v.neutral;
      const nps = total > 0 ? Math.round(((v.positive - v.negative) / total) * 100) : 0;
      return { date, ...v, nps };
    });
  }

  private buildPlatformBreakdown(
    events: OpinionEventEntity[],
  ): Array<{ platform: string; mentions: number; sentiment: number }> {
    const platformMap = new Map<string, { mentions: number; sentimentSum: number; count: number }>();
    events.forEach((e) => {
      const p = platformMap.get(e.platform) || { mentions: 0, sentimentSum: 0, count: 0 };
      p.mentions++;
      p.sentimentSum += e.sentimentScore ?? 0;
      p.count++;
      platformMap.set(e.platform, p);
    });
    return [...platformMap.entries()]
      .map(([platform, data]) => ({
        platform,
        mentions: data.mentions,
        sentiment: data.count > 0 ? Math.round((data.sentimentSum / data.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);
  }

  private buildTopKeywords(
    events: OpinionEventEntity[],
    totalEvents: number,
  ): Array<{ keyword: string; count: number; sentiment: number }> {
    const keywordMap = new Map<string, { count: number; sentimentSum: number }>();
    events.forEach((e) => {
      if (e.matchedKeywords) {
        e.matchedKeywords.forEach((kw: string) => {
          const entry = keywordMap.get(kw) || { count: 0, sentimentSum: 0 };
          entry.count++;
          entry.sentimentSum += e.sentimentScore ?? 0;
          keywordMap.set(kw, entry);
        });
      }
    });
    return [...keywordMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        sentiment: data.count > 0 ? Math.round((data.sentimentSum / data.count) * 100) / 100 : 0,
      }));
  }

  private async buildCompetitorComparison(
    userId: number,
    brandKeywords: string[],
    brandEvents: OpinionEventEntity[],
    allEvents: OpinionEventEntity[],
    start: Date,
    end: Date,
  ): Promise<Array<{ name: string; mentions: number; sentimentScore: number; shareOfVoice: number; trend: string }>> {
    const groups = await this.competitorGroupRepo.find({ where: { userId, isActive: 1 } });
    const brandTotal = brandEvents.length;
    const competitors: Array<{ name: string; keywords: string[] }> = [];

    for (const group of groups) {
      const configs: Array<{ name: string; keywords: string[] }> = JSON.parse(group.competitors);
      for (const c of configs) {
        if (!competitors.some((e) => e.name === c.name)) {
          competitors.push(c);
        }
      }
    }

    return competitors.slice(0, 6).map((comp) => {
      const compEvents = allEvents.filter((e) => {
        if (!e.matchedKeywords) return false;
        return comp.keywords.some((kw) =>
          e.matchedKeywords.some((mk: string) =>
            mk.toLowerCase().includes(kw.toLowerCase()),
          ),
        ) && !brandKeywords.some((bkw) =>
          e.matchedKeywords.some((mk: string) =>
            mk.toLowerCase().includes(bkw.toLowerCase()),
          ),
        );
      });

      const total = compEvents.length;
      const pos = compEvents.filter((e) => e.sentiment === 'positive').length;
      const neg = compEvents.filter((e) => e.sentiment === 'negative').length;
      const sentimentScore = total > 0 ? Math.round(((pos - neg) / total) * 100) : 0;
      const grandTotal = brandTotal + total;
      const shareOfVoice = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
      const trend = sentimentScore > 5 ? 'rising' : sentimentScore < -5 ? 'declining' : 'stable';

      return { name: comp.name, mentions: total, sentimentScore, shareOfVoice, trend };
    });
  }
}
