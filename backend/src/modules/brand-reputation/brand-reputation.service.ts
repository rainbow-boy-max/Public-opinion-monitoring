import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
    options?: { days?: number },
  ): Promise<BrandReputationData> {
    const days = options?.days || 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);

    const allEvents = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
      order: { matchedAt: 'ASC' },
    });

    const brandEvents = allEvents.filter((e) => {
      if (!e.matchedKeywords) return false;
      return brandKeywords.some((kw) =>
        e.matchedKeywords.some((mk: string) =>
          mk.toLowerCase().includes(kw.toLowerCase()),
        ),
      );
    });

    const totalBrand = brandEvents.length;
    const totalAll = allEvents.length;
    const shareOfVoice = totalAll > 0 ? Math.round((totalBrand / totalAll) * 100) : 0;

    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    let totalSentimentScore = 0;
    brandEvents.forEach((e) => {
      if (e.sentiment === 'positive') bySentiment.positive++;
      else if (e.sentiment === 'negative') bySentiment.negative++;
      else bySentiment.neutral++;
      totalSentimentScore += e.sentimentScore ?? 0;
    });

    const npsScore = totalBrand > 0
      ? Math.round(((bySentiment.positive - bySentiment.negative) / totalBrand) * 100)
      : 0;

    const avgSentimentScore = totalBrand > 0
      ? Math.round((totalSentimentScore / totalBrand) * 100) / 100
      : 0;

    const trend = this.calcTrend(npsScore);

    const sentimentTrend = this.buildSentimentTrend(brandEvents, start, end);

    const platformBreakdown = this.buildPlatformBreakdown(brandEvents);

    const topKeywords = this.buildTopKeywords(brandEvents, totalBrand);

    const competitorComparison = await this.buildCompetitorComparison(
      userId, brandKeywords, brandEvents, allEvents, start, end,
    );

    const recentMentions = brandEvents
      .sort((a, b) => b.matchedAt.getTime() - a.matchedAt.getTime())
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        title: e.title,
        platform: e.platform,
        sentiment: e.sentiment,
        engagement: (e.readCount || 0) + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0),
        publishedAt: e.publishTime,
        url: e.url,
      }));

    return {
      overview: {
        brandVoice: totalBrand,
        shareOfVoice,
        npsScore,
        sentimentScore: avgSentimentScore,
        trend,
      },
      sentimentTrend,
      platformBreakdown,
      topKeywords,
      competitorComparison,
      recentMentions,
    };
  }

  async getBrandComparison(
    userId: number,
    brandA: string[],
    brandB: string[],
  ): Promise<{ brandA: BrandReputationData; brandB: BrandReputationData }> {
    const [a, b] = await Promise.all([
      this.getReputation(userId, brandA),
      this.getReputation(userId, brandB),
    ]);
    return { brandA: a, brandB: b };
  }

  async getMockReputation(options?: { days?: number }): Promise<BrandReputationData> {
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
