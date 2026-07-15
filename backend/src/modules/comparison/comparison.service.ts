import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities';

export interface ComparisonQuery {
  keywords: string[][];
  platforms?: string[];
  startDate: string;
  endDate: string;
  interval?: 'hour' | 'day';
}

export interface ComparisonResult {
  groups: Array<{
    label: string;
    keywords: string[];
    stats: {
      total: number;
      bySentiment: { positive: number; negative: number; neutral: number };
      byPlatform: Record<string, number>;
      trend: Array<{ time: string; count: number }>;
      avgEngagement: number;
      topArticles: Array<{ title: string; platform: string; url: string; engagement: number }>;
    };
  }>;
  period: { start: string; end: string };
}

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async compare(params: ComparisonQuery): Promise<ComparisonResult> {
    if (!params.keywords || params.keywords.length < 2) {
      throw new BadRequestException('At least 2 keyword groups are required');
    }
    if (params.keywords.length > 5) {
      throw new BadRequestException('Maximum 5 keyword groups allowed');
    }

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    const rawEvents = await this.eventRepo.find({
      where: {
        matchedAt: Between(startDate, endDate),
      },
      order: { matchedAt: 'ASC' },
    });

    const interval = params.interval || 'day';

    const groups = params.keywords.map((keywordGroup) => {
      let filtered = rawEvents.filter((e) => {
        if (!e.matchedKeywords) return false;
        return keywordGroup.some((kw) =>
          e.matchedKeywords.some((mk: string) =>
            mk.toLowerCase().includes(kw.toLowerCase()),
          ),
        );
      });

      if (params.platforms && params.platforms.length > 0) {
        filtered = filtered.filter((e) =>
          params.platforms!.includes(e.platform),
        );
      }

      const bySentiment = { positive: 0, negative: 0, neutral: 0 };
      const byPlatform: Record<string, number> = {};
      let totalEngagement = 0;

      filtered.forEach((e) => {
        if (e.sentiment === 'positive') bySentiment.positive++;
        else if (e.sentiment === 'negative') bySentiment.negative++;
        else bySentiment.neutral++;

        const platform = e.platform || 'unknown';
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;

        totalEngagement +=
          (e.readCount || 0) +
          (e.likeCount || 0) +
          (e.commentCount || 0) +
          (e.shareCount || 0);
      });

      const trend = this.buildTrend(filtered, startDate, endDate, interval);

      const sortedByEngagement = [...filtered].sort((a, b) => {
        const ea = (a.readCount || 0) + (a.likeCount || 0) + (a.commentCount || 0) + (a.shareCount || 0);
        const eb = (b.readCount || 0) + (b.likeCount || 0) + (b.commentCount || 0) + (b.shareCount || 0);
        return eb - ea;
      });

      const total = filtered.length;
      const topArticles = sortedByEngagement.slice(0, 10).map((e) => ({
        title: e.title,
        platform: e.platform,
        url: e.url,
        engagement: (e.readCount || 0) + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0),
      }));

      const label = keywordGroup.length > 0
        ? `关键词组: ${keywordGroup.join(', ')}`
        : '未命名组';

      return {
        label,
        keywords: keywordGroup,
        stats: {
          total,
          bySentiment,
          byPlatform,
          trend,
          avgEngagement: total > 0 ? Math.round(totalEngagement / total) : 0,
          topArticles,
        },
      };
    });

    return {
      groups,
      period: { start: params.startDate, end: params.endDate },
    };
  }

  async exportComparison(params: ComparisonQuery): Promise<{ filename: string; content: string }> {
    const result = await this.compare(params);
    const filename = `comparison-${params.startDate}-${params.endDate}.json`;
    return { filename, content: JSON.stringify(result, null, 2) };
  }

  async getMockComparison(): Promise<ComparisonResult> {
    const now = Date.now();
    const day = 86400000;
    const trendPoints: Array<{ time: string; count: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now - (6 - i) * day);
      const time = d.toISOString().slice(0, 10);
      trendPoints.push({ time, count: Math.round(Math.random() * 200 + 100 + i * 15) });
    }

    const trendPoints2: Array<{ time: string; count: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now - (6 - i) * day);
      const time = d.toISOString().slice(0, 10);
      trendPoints2.push({ time, count: Math.round(Math.random() * 150 + 50 + (6 - i) * 12) });
    }

    return {
      groups: [
        {
          label: '品牌A',
          keywords: ['品牌A', '产品A'],
          stats: {
            total: 2847,
            bySentiment: { positive: 1203, negative: 856, neutral: 788 },
            byPlatform: { weibo: 980, weixin: 654, douyin: 523, xiaohongshu: 412, baijiahao: 278 },
            trend: trendPoints,
            avgEngagement: 102,
            topArticles: [
              { title: '品牌A新品发布引发热议', platform: 'weibo', url: '#', engagement: 45200 },
              { title: '品牌A用户体验深度评测', platform: 'weixin', url: '#', engagement: 32100 },
              { title: '品牌A价格争议讨论', platform: 'douyin', url: '#', engagement: 28700 },
            ],
          },
        },
        {
          label: '品牌B',
          keywords: ['品牌B', '产品B'],
          stats: {
            total: 2135,
            bySentiment: { positive: 356, negative: 1120, neutral: 659 },
            byPlatform: { weibo: 756, weixin: 432, douyin: 389, xiaohongshu: 298, baijiahao: 260 },
            trend: trendPoints2,
            avgEngagement: 214,
            topArticles: [
              { title: '品牌B产品质量问题引关注', platform: 'weibo', url: '#', engagement: 67800 },
              { title: '品牌B售后服务遭投诉', platform: 'xiaohongshu', url: '#', engagement: 42300 },
              { title: '品牌B监管调查进展', platform: 'baijiahao', url: '#', engagement: 21500 },
            ],
          },
        },
        {
          label: '品牌C',
          keywords: ['品牌C', '产品C'],
          stats: {
            total: 1689,
            bySentiment: { positive: 987, negative: 234, neutral: 468 },
            byPlatform: { weibo: 456, weixin: 523, douyin: 298, xiaohongshu: 234, baijiahao: 178 },
            trend: [
              { time: new Date(now - 6 * day).toISOString().slice(0, 10), count: 120 },
              { time: new Date(now - 5 * day).toISOString().slice(0, 10), count: 180 },
              { time: new Date(now - 4 * day).toISOString().slice(0, 10), count: 220 },
              { time: new Date(now - 3 * day).toISOString().slice(0, 10), count: 280 },
              { time: new Date(now - 2 * day).toISOString().slice(0, 10), count: 350 },
              { time: new Date(now - 1 * day).toISOString().slice(0, 10), count: 310 },
              { time: new Date(now).toISOString().slice(0, 10), count: 229 },
            ],
            avgEngagement: 73,
            topArticles: [
              { title: '品牌C创新设计获行业奖项', platform: 'weixin', url: '#', engagement: 18900 },
              { title: '品牌C环保理念受好评', platform: 'weibo', url: '#', engagement: 15600 },
              { title: '品牌C品牌升级战略发布', platform: 'baijiahao', url: '#', engagement: 12300 },
            ],
          },
        },
      ],
      period: { start: new Date(now - 6 * day).toISOString().slice(0, 10), end: new Date(now).toISOString().slice(0, 10) },
    };
  }

  private buildTrend(
    events: OpinionEventEntity[],
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day',
  ): Array<{ time: string; count: number }> {
    const buckets: Record<string, number> = {};

    if (interval === 'hour') {
      const totalHours = Math.ceil((endDate.getTime() - startDate.getTime()) / 3600000);
      for (let i = 0; i < Math.min(totalHours, 168); i++) {
        const d = new Date(startDate.getTime() + i * 3600000);
        const key = d.toISOString().slice(0, 13).replace('T', ' ') + ':00';
        buckets[key] = 0;
      }
      events.forEach((e) => {
        const d = new Date(e.matchedAt);
        const key = d.toISOString().slice(0, 13).replace('T', ' ') + ':00';
        if (buckets[key] !== undefined) buckets[key]++;
      });
    } else {
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
      for (let i = 0; i < Math.min(totalDays, 365); i++) {
        const d = new Date(startDate.getTime() + i * 86400000);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = 0;
      }
      events.forEach((e) => {
        const key = new Date(e.matchedAt).toISOString().slice(0, 10);
        if (buckets[key] !== undefined) buckets[key]++;
      });
    }

    return Object.entries(buckets).map(([time, count]) => ({ time, count }));
  }
}
