import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

export interface HotTopic {
  id: string;
  keywords: string[];
  currentVolume: number;
  previousVolume: number;
  growthRate: number;
  acceleration: number;
  platforms: string[];
  sentimentDistribution: { positive: number; negative: number; neutral: number };
  topArticles: Array<{ id: number; title: string; platform: string; url: string; engagement: number }>;
  score: number;
  firstDetectedAt: string;
  trend: 'rising' | 'falling' | 'stable';
}

export interface GetHotTopicsOptions {
  windowHours?: number;
  minMentions?: number;
  topN?: number;
}

export interface TopicDetail {
  topic: HotTopic;
  events: OpinionEventEntity[];
  hourlyBreakdown: Array<{ hour: string; volume: number }>;
  sentimentTrend: Array<{ hour: string; positive: number; negative: number; neutral: number }>;
}

@Injectable()
export class HotTopicsService {
  private readonly logger = new Logger(HotTopicsService.name);

  constructor(
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async getHotTopics(userId: number, options?: GetHotTopicsOptions): Promise<HotTopic[]> {
    const windowHours = options?.windowHours ?? 1;
    const minMentions = options?.minMentions ?? 3;
    const topN = options?.topN ?? 10;

    const now = new Date();
    const currentStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - windowHours * 60 * 60 * 1000);
    const windowBeforePreviousStart = new Date(previousStart.getTime() - windowHours * 60 * 60 * 1000);

    const tasks = await this.taskRepo.find({ where: { userId } });
    if (tasks.length === 0) return [];
    const taskIds = tasks.map(t => t.id);

    const [currentEvents, previousEvents, olderEvents] = await Promise.all([
      this.eventRepo.find({ where: { taskId: In(taskIds), matchedAt: Between(currentStart, now) } }),
      this.eventRepo.find({ where: { taskId: In(taskIds), matchedAt: Between(previousStart, currentStart) } }),
      this.eventRepo.find({ where: { taskId: In(taskIds), matchedAt: Between(windowBeforePreviousStart, previousStart) } }),
    ]);

    const currentGroups = this.groupByKeywords(currentEvents);
    const previousGroups = this.groupByKeywords(previousEvents);
    const olderGroups = this.groupByKeywords(olderEvents);

    const topics: HotTopic[] = [];

    for (const [key, events] of currentGroups) {
      if (events.length < minMentions) continue;

      const keywords = key.split('::');
      const currentVolume = events.length;
      const prevEvents = previousGroups.get(key) || [];
      const olderEventsForKey = olderGroups.get(key) || [];
      const previousVolume = prevEvents.length;
      const olderVolume = olderEventsForKey.length;

      const growthRate = ((currentVolume - previousVolume) / Math.max(previousVolume, 1)) * 100;

      const prevGrowthRate = previousVolume > 0
        ? ((previousVolume - olderVolume) / Math.max(olderVolume, 1)) * 100
        : 0;
      const acceleration = growthRate - prevGrowthRate;

      const platforms = [...new Set(events.map(e => e.platform))];

      const sentiments = { positive: 0, negative: 0, neutral: 0 };
      for (const e of events) {
        if (e.sentiment === 'positive') sentiments.positive++;
        else if (e.sentiment === 'negative') sentiments.negative++;
        else sentiments.neutral++;
      }

      const sorted = [...events].sort(
        (a, b) => (b.readCount + b.likeCount + b.commentCount + b.shareCount)
          - (a.readCount + a.likeCount + a.commentCount + a.shareCount),
      );
      const topArticles = sorted.slice(0, 5).map(e => ({
        id: e.id,
        title: e.title,
        platform: e.platform,
        url: e.url,
        engagement: e.readCount + e.likeCount + e.commentCount + e.shareCount,
      }));

      const firstDetectedAt = [...events].sort((a, b) => a.matchedAt.getTime() - b.matchedAt.getTime())[0].matchedAt.toISOString();

      const platformTypes = ['weixin', 'weixin_video', 'douyin', 'xiaohongshu', 'kuaishou', 'weibo', 'baijiahao'];
      const platformDiversity = platforms.length / platformTypes.length;

      const score = (currentVolume * 0.3) + (growthRate * 0.4) + (acceleration * 0.2) + (platformDiversity * 0.1);

      let trend: 'rising' | 'falling' | 'stable';
      if (growthRate > 20) trend = 'rising';
      else if (growthRate < -20) trend = 'falling';
      else trend = 'stable';

      const id = this.hashString(key);

      topics.push({
        id,
        keywords,
        currentVolume,
        previousVolume,
        growthRate: Math.round(growthRate * 100) / 100,
        acceleration: Math.round(acceleration * 100) / 100,
        platforms,
        sentimentDistribution: sentiments,
        topArticles,
        score: Math.round(score * 100) / 100,
        firstDetectedAt,
        trend,
      });
    }

    topics.sort((a, b) => b.score - a.score);
    return topics.slice(0, topN);
  }

  async getTopicDetail(userId: number, topicId: string): Promise<TopicDetail> {
    const topics = await this.getHotTopics(userId, { minMentions: 1, topN: 100 });
    const topic = topics.find(t => t.id === topicId);
    if (!topic) throw new NotFoundException('Topic not found');

    const tasks = await this.taskRepo.find({ where: { userId } });
    const taskIds = tasks.map(t => t.id);

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const events = await this.eventRepo.find({
      where: { taskId: In(taskIds), matchedAt: Between(past24h, now) },
      order: { matchedAt: 'DESC' },
    });

    const keywordSet = new Set(topic.keywords);
    const matchingEvents = events.filter(e =>
      e.matchedKeywords.some(k => keywordSet.has(k)),
    );

    const hourlyBreakdown: Array<{ hour: string; volume: number }> = [];
    const sentimentTrend: Array<{ hour: string; positive: number; negative: number; neutral: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEvents = matchingEvents.filter(
        e => e.matchedAt >= hourStart && e.matchedAt < hourEnd,
      );
      const label = `${String(hourStart.getHours()).padStart(2, '0')}:00`;
      hourlyBreakdown.push({ hour: label, volume: hourEvents.length });
      sentimentTrend.push({
        hour: label,
        positive: hourEvents.filter(e => e.sentiment === 'positive').length,
        negative: hourEvents.filter(e => e.sentiment === 'negative').length,
        neutral: hourEvents.filter(e => e.sentiment === 'neutral').length,
      });
    }

    return { topic, events: matchingEvents, hourlyBreakdown, sentimentTrend };
  }

  private groupByKeywords(events: OpinionEventEntity[]): Map<string, OpinionEventEntity[]> {
    const map = new Map<string, OpinionEventEntity[]>();
    for (const event of events) {
      if (!event.matchedKeywords || event.matchedKeywords.length === 0) continue;
      const kw = [...event.matchedKeywords].sort();
      const key = kw.join('::');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
