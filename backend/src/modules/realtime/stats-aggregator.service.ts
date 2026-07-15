import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';
import { RealtimeGateway } from './realtime.gateway';

interface UserStats {
  total: number;
  byPlatform: Record<string, number>;
  bySentiment: { positive: number; negative: number; neutral: number };
  hourlyTrend: number[];
  topKeywords: Array<{ keyword: string; count: number }>;
  platformTrend: Array<{ hour: number; platform: string; count: number }>;
  sentimentTrend: Array<{ hour: number; positive: number; negative: number; neutral: number }>;
  recentEvents: Array<{ title: string; platform: string; sentiment: string; matchedAt: Date }>;
  updatedAt: string;
}

@Injectable()
export class StatsAggregatorService {
  private readonly logger = new Logger(StatsAggregatorService.name);
  private cache = new Map<number, { stats: UserStats; cachedAt: number }>();
  private readonly CACHE_TTL = 30000;

  constructor(
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity) private taskRepo: Repository<MonitorTaskEntity>,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async aggregateForUser(userId: number): Promise<UserStats> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      return cached.stats;
    }

    const tasks = await this.taskRepo.find({
      where: { userId },
      select: ['id'],
    });
    if (tasks.length === 0) {
      const emptyStats: UserStats = {
        total: 0,
        byPlatform: {},
        bySentiment: { positive: 0, negative: 0, neutral: 0 },
        hourlyTrend: new Array(24).fill(0),
        topKeywords: [],
        platformTrend: [],
        sentimentTrend: Array.from({ length: 24 }, (_, i) => ({ hour: i, positive: 0, negative: 0, neutral: 0 })),
        recentEvents: [],
        updatedAt: new Date().toISOString(),
      };
      return emptyStats;
    }

    const taskIds = tasks.map((t) => t.id);
    const since = new Date(Date.now() - 24 * 3600 * 1000);

    const allEvents = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.task_id IN (:...taskIds)', { taskIds })
      .andWhere('e.status = 0')
      .getMany();

    const timeWindowEvents = allEvents.filter(
      (e) => new Date(e.matchedAt).getTime() >= since.getTime(),
    );

    const byPlatform: Record<string, number> = {};
    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    const hourlyTrend = new Array(24).fill(0);

    for (const event of timeWindowEvents) {
      byPlatform[event.platform] = (byPlatform[event.platform] || 0) + 1;
      bySentiment[event.sentiment] += 1;
      const hour = new Date(event.matchedAt).getHours();
      hourlyTrend[hour] += 1;
    }

    // topKeywords
    const kwCount = new Map<string, number>();
    for (const e of timeWindowEvents) {
      const kws: string[] = (e as any).matchedKeywords || [];
      for (const kw of kws) {
        kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
      }
    }
    const topKeywords = Array.from(kwCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // sentimentTrend
    const sentimentTrend = Array.from({ length: 24 }, (_, i) => ({ hour: i, positive: 0, negative: 0, neutral: 0 }));
    for (const e of timeWindowEvents) {
      const hour = new Date(e.matchedAt).getHours();
      if (e.sentiment === 'positive') sentimentTrend[hour].positive += 1;
      else if (e.sentiment === 'negative') sentimentTrend[hour].negative += 1;
      else sentimentTrend[hour].neutral += 1;
    }

    // platformTrend
    const platformHours = new Map<string, number[]>();
    for (const e of timeWindowEvents) {
      if (!platformHours.has(e.platform)) {
        platformHours.set(e.platform, new Array(24).fill(0));
      }
      const hour = new Date(e.matchedAt).getHours();
      platformHours.get(e.platform)![hour] += 1;
    }
    const platformTrend: Array<{ hour: number; platform: string; count: number }> = [];
    for (const [platform, hours] of platformHours) {
      for (let h = 0; h < 24; h++) {
        platformTrend.push({ hour: h, platform, count: hours[h] });
      }
    }

    // latestEvents
    const latestEvents = [...timeWindowEvents]
      .sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime())
      .slice(0, 20)
      .map((e) => ({
        title: e.title,
        platform: e.platform,
        sentiment: e.sentiment,
        matchedAt: e.matchedAt,
      }));

    const stats: UserStats = {
      total: allEvents.length,
      byPlatform,
      bySentiment,
      hourlyTrend,
      topKeywords,
      platformTrend,
      sentimentTrend,
      recentEvents: latestEvents,
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(userId, { stats, cachedAt: Date.now() });
    return stats;
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async refreshAllUserStats(): Promise<void> {
    try {
      const users = await this.taskRepo
        .createQueryBuilder('t')
        .select('DISTINCT t.userId', 'userId')
        .getRawMany<{ userId: number }>();

      for (const u of users) {
        this.cache.delete(Number(u.userId));
        const stats = await this.aggregateForUser(Number(u.userId));
        await this.realtimeGateway.broadcastStats(u.userId, stats);
      }
    } catch (err) {
      this.logger.error('Failed to refresh stats', err as Error);
    }
  }

  invalidate(userId: number): void {
    this.cache.delete(userId);
  }
}
