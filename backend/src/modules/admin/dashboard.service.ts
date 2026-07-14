import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import {
  MonitorTaskEntity,
  OpinionEventEntity,
  LlmModelEntity,
  AgentEntity,
} from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { AuditService, DASHBOARD_ACTIVITY_CHANNEL } from './audit.service';
import { UserManagementService } from './services/user-management.service';

const OVERVIEW_CACHE_KEY = (roleFilter: string) =>
  `admin:dashboard:overview:${roleFilter || 'all'}`;
const ACTIVITY_CHANNEL = DASHBOARD_ACTIVITY_CHANNEL;
const OVERVIEW_TTL_SEC = 30;

export interface DashboardOverviewKpis {
  usersTotal: number;
  monitorTasks: number;
  todaySentiment: number;
  pendingAlerts: number;
  activeAgents: number;
}

export interface DashboardTrendPoint {
  date: string;
  sentiment: number;
  alerts: number;
}

export interface DashboardPlatformPoint {
  platform: string;
  count: number;
}

export interface DashboardOverview {
  kpis: DashboardOverviewKpis;
  trend7d: DashboardTrendPoint[];
  platformDistribution: DashboardPlatformPoint[];
  generatedAt: string;
  cacheHit: boolean;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(MonitorTaskEntity)
    private monitorRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(LlmModelEntity) private llmRepo: Repository<LlmModelEntity>,
    @InjectRepository(AgentEntity) private agentRepo: Repository<AgentEntity>,
    private redisService: RedisService,
    private auditService: AuditService,
    private userManagementService: UserManagementService,
  ) {}

  async getOverview(roleFilter?: string): Promise<DashboardOverview> {
    const roleKey = roleFilter || '';
    const cached = await this.redisService.get(OVERVIEW_CACHE_KEY(roleKey));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DashboardOverview;
        return { ...parsed, cacheHit: true };
      } catch {
        /* fall through */
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [usersTotal, monitorTasks, todaySentiment, activeAgents] = await Promise.all([
      this.userManagementService.countByRole(roleFilter),
      this.monitorRepo.count({ where: { status: 'enabled' as any } }),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.matched_at >= :ts', { ts: todayStart })
        .getCount()
        .catch(() => 0),
      this.llmRepo
        .createQueryBuilder('l')
        .innerJoin(AgentEntity, 'a', 'a.primary_model_id = l.id')
        .where('a.status = :st', { st: 'enabled' })
        .getCount()
        .catch(() => 0),
    ]);

    const pendingAlerts = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.sentiment = :s', { s: 'negative' as any })
      .andWhere('e.matched_at >= :ts', { ts: todayStart })
      .getCount()
      .catch(() => 0);

    const trendRaw: Array<{ d: string; sentiment: number; alerts: number }> = await this.eventRepo
      .createQueryBuilder('e')
      .select("DATE_FORMAT(e.matched_at, '%Y-%m-%d')", 'd')
      .addSelect('COUNT(*)', 'sentiment')
      .addSelect(
        "SUM(CASE WHEN e.sentiment = 'negative' THEN 1 ELSE 0 END)",
        'alerts',
      )
      .where('e.matched_at >= :ts', { ts: sevenDaysAgo })
      .groupBy('d')
      .orderBy('d', 'ASC')
      .getRawMany()
      .catch(() => [] as any[]);

    const trend7d: DashboardTrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const row = trendRaw.find((r) => r.d === key);
      trend7d.push({
        date: key,
        sentiment: row ? Number(row.sentiment) || 0 : 0,
        alerts: row ? Number(row.alerts) || 0 : 0,
      });
    }

    const platformRaw: Array<{ platform: string; cnt: string }> = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.platform', 'platform')
      .addSelect('COUNT(*)', 'cnt')
      .where('e.matched_at >= :ts', { ts: sevenDaysAgo })
      .groupBy('e.platform')
      .orderBy('cnt', 'DESC')
      .limit(8)
      .getRawMany()
      .catch(() => [] as any[]);

    const platformDistribution: DashboardPlatformPoint[] = platformRaw.map((r) => ({
      platform: r.platform,
      count: Number(r.cnt) || 0,
    }));

    const overview: DashboardOverview = {
      kpis: {
        usersTotal,
        monitorTasks,
        todaySentiment,
        pendingAlerts,
        activeAgents,
      },
      trend7d,
      platformDistribution,
      generatedAt: new Date().toISOString(),
      cacheHit: false,
    };

    try {
      await this.redisService.set(
        OVERVIEW_CACHE_KEY(roleKey),
        JSON.stringify(overview),
        OVERVIEW_TTL_SEC,
      );
    } catch (err) {
      this.logger.warn(`overview cache failed: ${(err as Error).message}`);
    }

    return overview;
  }

  async getRecentActivities(limit = 20): Promise<{ items: any[] }> {
    const items = await this.auditService.recent(limit);
    return { items };
  }

  streamRecentActivities(): Observable<{ data: any; type?: string }> {
    return new Observable<{ data: any; type?: string }>((subscriber) => {
      let closed = false;
      const heartbeat = setInterval(() => {
        if (closed) return;
        subscriber.next({ type: 'ping', data: { ts: Date.now() } });
      }, 25_000);

      const onMessage = (raw: string) => {
        if (closed) return;
        try {
          const payload = JSON.parse(raw);
          subscriber.next({ type: 'activity', data: payload });
        } catch (err) {
          this.logger.warn('activity payload parse failed');
        }
      };

      this.redisService
        .subscribe(ACTIVITY_CHANNEL, onMessage)
        .catch((err) => {
          this.logger.error('dashboard SSE subscribe failed', err as Error);
          subscriber.error(err);
        });

      return () => {
        closed = true;
        clearInterval(heartbeat);
        void this.redisService.unsubscribe(ACTIVITY_CHANNEL).catch(() => undefined);
      };
    });
  }

  async publishActivity(payload: any): Promise<void> {
    try {
      await this.redisService.publish(ACTIVITY_CHANNEL, JSON.stringify(payload));
    } catch (err) {
      this.logger.warn(`publish activity failed: ${(err as Error).message}`);
    }
  }
}
