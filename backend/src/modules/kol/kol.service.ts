import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities';

export interface KolProfile {
  id: string;
  name: string;
  avatar?: string;
  platform: string;
  totalMentions: number;
  totalEngagement: number;
  avgSentiment: number;
  influenceScore: number;
  topKeywords: string[];
  trend: 'rising' | 'stable' | 'declining';
}

export interface KolDetail extends KolProfile {
  recentArticles: Array<{ title: string; url: string; publishedAt: Date; engagement: number; sentiment: string }>;
  sentimentTrend: Array<{ date: string; score: number }>;
  platformBreakdown: Record<string, number>;
}

@Injectable()
export class KolService {
  private readonly logger = new Logger(KolService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async getTopInfluencers(userId: number, options?: {
    taskIds?: number[];
    days?: number;
    limit?: number;
  }): Promise<KolProfile[]> {
    const days = options?.days ?? 30;
    const limit = options?.limit ?? 20;
    const since = new Date(Date.now() - days * 86400000);

    const where: any = {
      publishTime: MoreThanOrEqual(since),
    };
    if (options?.taskIds && options.taskIds.length > 0) {
      where.taskId = In(options.taskIds);
    }

    const events = await this.eventRepo.find({
      where,
      order: { readCount: 'DESC' },
    });

    const authorMap = new Map<string, {
      mentions: number;
      engagement: number;
      sentimentScores: number[];
      platforms: Set<string>;
      keywords: Set<string>;
    }>();

    for (const event of events) {
      const author = event.author || 'unknown';
      if (!authorMap.has(author)) {
        authorMap.set(author, {
          mentions: 0, engagement: 0, sentimentScores: [],
          platforms: new Set(), keywords: new Set(),
        });
      }
      const entry = authorMap.get(author)!;
      entry.mentions++;
      entry.engagement += (event.readCount || 0) + (event.likeCount || 0) + (event.commentCount || 0) + (event.shareCount || 0);
      if (event.sentiment === 'positive') entry.sentimentScores.push(1);
      else if (event.sentiment === 'negative') entry.sentimentScores.push(-1);
      else entry.sentimentScores.push(0);
      entry.platforms.add(event.platform);
      if (event.matchedKeywords) {
        for (const kw of event.matchedKeywords) entry.keywords.add(kw);
      }
    }

    const profiles: KolProfile[] = Array.from(authorMap.entries())
      .map(([name, data]) => {
        const avgSentiment = data.sentimentScores.length > 0
          ? data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
          : 0;
        const influenceScore = Math.min(100, Math.max(0, Math.round(
          (data.mentions * 10 + Math.log2(data.engagement + 1) * 20 + (avgSentiment + 1) * 30) * 10
        ) / 10));
        const platforms = Array.from(data.platforms);
        return {
          id: Buffer.from(name).toString('base64').slice(0, 16),
          name,
          platform: platforms[0] || 'unknown',
          totalMentions: data.mentions,
          totalEngagement: data.engagement,
          avgSentiment: Math.round(avgSentiment * 100) / 100,
          influenceScore,
          topKeywords: Array.from(data.keywords).slice(0, 10),
          trend: 'stable' as const,
        };
      })
      .sort((a, b) => b.influenceScore - a.influenceScore)
      .slice(0, limit);

    return profiles;
  }

  async getKolDetail(author: string, userId: number): Promise<KolDetail> {
    const events = await this.eventRepo.find({
      where: { author },
      order: { publishTime: 'DESC' },
      take: 100,
    });

    const recentArticles = events.slice(0, 20).map(e => ({
      title: e.title,
      url: e.url,
      publishedAt: e.publishTime,
      engagement: (e.readCount || 0) + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0),
      sentiment: e.sentiment,
    }));

    const sentimentMap = new Map<string, number[]>();
    for (const e of events) {
      const dateKey = e.publishTime.toISOString().slice(0, 10);
      if (!sentimentMap.has(dateKey)) sentimentMap.set(dateKey, []);
      const score = e.sentiment === 'positive' ? 1 : e.sentiment === 'negative' ? -1 : 0;
      sentimentMap.get(dateKey)!.push(score);
    }
    const sentimentTrend = Array.from(sentimentMap.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const platformBreakdown: Record<string, number> = {};
    for (const e of events) {
      platformBreakdown[e.platform] = (platformBreakdown[e.platform] || 0) + 1;
    }

    const mentionCount = events.length;
    const totalEngagement = events.reduce((s, e) => s + (e.readCount || 0) + (e.likeCount || 0) + (e.commentCount || 0) + (e.shareCount || 0), 0);
    const allScores = events.map(e => e.sentiment === 'positive' ? 1 : e.sentiment === 'negative' ? -1 : 0);
    const avgSentiment = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const influenceScore = Math.min(100, Math.max(0, Math.round(
      (mentionCount * 10 + Math.log2(totalEngagement + 1) * 20 + (avgSentiment + 1) * 30) * 10
    ) / 10));

    const platforms = Object.keys(platformBreakdown);

    return {
      id: Buffer.from(author).toString('base64').slice(0, 16),
      name: author,
      platform: platforms[0] || 'unknown',
      totalMentions: mentionCount,
      totalEngagement,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      influenceScore,
      topKeywords: [],
      trend: 'stable',
      recentArticles,
      sentimentTrend,
      platformBreakdown,
    };
  }

  async getMockKols(): Promise<KolProfile[]> {
    return [
      { id: '1', name: '热门话题君', platform: 'weibo', totalMentions: 156, totalEngagement: 850000, avgSentiment: -0.6, influenceScore: 92, topKeywords: ['质量', '品牌', '曝光'], trend: 'rising' },
      { id: '2', name: '科技早报', platform: 'weixin', totalMentions: 89, totalEngagement: 320000, avgSentiment: -0.3, influenceScore: 85, topKeywords: ['科技', '产品', '评测'], trend: 'stable' },
      { id: '3', name: '消费预警', platform: 'douyin', totalMentions: 203, totalEngagement: 1200000, avgSentiment: -0.8, influenceScore: 95, topKeywords: ['提醒', '质量问题', '避坑'], trend: 'rising' },
      { id: '4', name: '社会热点', platform: 'kuaishou', totalMentions: 67, totalEngagement: 560000, avgSentiment: -0.5, influenceScore: 78, topKeywords: ['维权', '集体', '扩散'], trend: 'declining' },
      { id: '5', name: '品牌观察', platform: 'xiaohongshu', totalMentions: 112, totalEngagement: 280000, avgSentiment: 0.2, influenceScore: 88, topKeywords: ['品牌', '设计', '体验'], trend: 'rising' },
    ];
  }
}
