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

    const recentEvents = allEvents.filter(
      (e) => new Date(e.matchedAt).getTime() >= since.getTime(),
    );

    const byPlatform: Record<string, number> = {};
    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    const hourlyTrend = new Array(24).fill(0);

    for (const event of recentEvents) {
      byPlatform[event.platform] = (byPlatform[event.platform] || 0) + 1;
      bySentiment[event.sentiment] += 1;
      const hour = new Date(event.matchedAt).getHours();
      hourlyTrend[hour] += 1;
    }

    const stats: UserStats = {
      total: allEvents.length,
      byPlatform,
      bySentiment,
      hourlyTrend,
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
