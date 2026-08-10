import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { MonitorTaskEntity } from '../../database/entities';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';

export interface ModuleHealth {
  module: string;
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  error?: string;
  checks: Record<string, string | number | boolean>;
}

export interface FixActionResult {
  module: string;
  action: string;
  success: boolean;
  message: string;
}

@Injectable()
export class OpsMonitorService {
  private readonly logger = new Logger(OpsMonitorService.name);

  constructor(
    private readonly redis: RedisService,
    @InjectQueue('task-queue') private readonly taskQueue: Queue,
    @InjectRepository(MonitorTaskEntity)
    private readonly taskRepo: Repository<MonitorTaskEntity>,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async checkAll(): Promise<ModuleHealth[]> {
    const checks = await Promise.all([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkBullQueue(),
      this.checkFeatureFlags(),
      this.checkCollector(),
    ]);
    return checks;
  }

  async checkModule(moduleName: string): Promise<ModuleHealth | null> {
    const map: Record<string, () => Promise<ModuleHealth>> = {
      redis: this.checkRedis.bind(this),
      database: this.checkDatabase.bind(this),
      bull_queue: this.checkBullQueue.bind(this),
      feature_flags: this.checkFeatureFlags.bind(this),
      collector: this.checkCollector.bind(this),
    };
    const fn = map[moduleName];
    if (!fn) return null;
    return fn();
  }

  async fixModule(moduleName: string): Promise<FixActionResult> {
    const map: Record<string, () => Promise<FixActionResult>> = {
      bull_queue: this.fixBullQueue.bind(this),
      feature_flags: this.fixFeatureFlags.bind(this),
      collector: this.fixCollector.bind(this),
    };
    const fn = map[moduleName];
    if (!fn) return { module: moduleName, action: 'fix', success: false, message: `No fix available for ${moduleName}` };
    return fn();
  }

  async fixAll(): Promise<FixActionResult[]> {
    const results = await Promise.all([
      this.fixBullQueue(),
      this.fixFeatureFlags(),
      this.fixCollector(),
    ]);
    return results;
  }

  private async checkRedis(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      const ping = await this.redis.client.ping();
      const latency = Date.now() - start;
      return {
        module: 'redis', name: 'Redis 缓存服务',
        status: ping === 'PONG' ? 'ok' : 'degraded',
        latency, checks: { ping: ping === 'PONG' ? 'ok' : 'fail' },
      };
    } catch (err) {
      return {
        module: 'redis', name: 'Redis 缓存服务', status: 'down',
        latency: Date.now() - start,
        error: (err as Error).message, checks: { ping: 'down' },
      };
    }
  }

  private async checkDatabase(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      const count = await this.taskRepo.count();
      const latency = Date.now() - start;
      return {
        module: 'database', name: '数据库连接',
        status: 'ok', latency,
        checks: { query: 'ok', taskCount: count },
      };
    } catch (err) {
      return {
        module: 'database', name: '数据库连接', status: 'down',
        latency: Date.now() - start,
        error: (err as Error).message, checks: { query: 'down' },
      };
    }
  }

  private async checkBullQueue(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      const [waiting, active, failed, delayed] = await Promise.all([
        this.taskQueue.getWaitingCount(),
        this.taskQueue.getActiveCount(),
        this.taskQueue.getFailedCount(),
        this.taskQueue.getDelayedCount(),
      ]);
      const latency = Date.now() - start;
      const status = failed > 10 ? 'degraded' : 'ok';
      return {
        module: 'bull_queue', name: '任务队列 (Bull)',
        status, latency,
        checks: { waiting, active, failed, delayed, status },
      };
    } catch (err) {
      return {
        module: 'bull_queue', name: '任务队列 (Bull)', status: 'down',
        latency: Date.now() - start,
        error: (err as Error).message, checks: { queue: 'down' },
      };
    }
  }

  private async checkFeatureFlags(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      await this.featureFlags.listFlags();
      const latency = Date.now() - start;
      return {
        module: 'feature_flags', name: '功能开关',
        status: 'ok', latency, checks: { query: 'ok' },
      };
    } catch (err) {
      return {
        module: 'feature_flags', name: '功能开关', status: 'down',
        latency: Date.now() - start,
        error: (err as Error).message, checks: { query: 'down' },
      };
    }
  }

  private async checkCollector(): Promise<ModuleHealth> {
    const start = Date.now();
    try {
      const tasks = await this.taskRepo.find({ take: 1, order: { lastRunAt: 'DESC' } });
      const latency = Date.now() - start;
      const lastRun = tasks[0]?.lastRunAt;
      const stale = lastRun ? (Date.now() - lastRun.getTime()) > 30 * 60 * 1000 : true;
      return {
        module: 'collector', name: '数据采集器',
        status: stale ? 'degraded' : 'ok',
        latency,
        checks: { lastRun: lastRun?.toISOString() || 'never', stale },
      };
    } catch (err) {
      return {
        module: 'collector', name: '数据采集器', status: 'down',
        latency: Date.now() - start,
        error: (err as Error).message, checks: { query: 'down' },
      };
    }
  }

  private async fixBullQueue(): Promise<FixActionResult> {
    try {
      const failed = await this.taskQueue.getFailed();
      if (failed.length > 0) {
        for (const job of failed) {
          await job.remove();
        }
        return { module: 'bull_queue', action: 'fix', success: true, message: `Removed ${failed.length} failed jobs` };
      }
      return { module: 'bull_queue', action: 'fix', success: true, message: 'No failed jobs found' };
    } catch (err) {
      return { module: 'bull_queue', action: 'fix', success: false, message: (err as Error).message };
    }
  }

  private async fixFeatureFlags(): Promise<FixActionResult> {
    try {
      this.featureFlags.invalidateCache();
      return { module: 'feature_flags', action: 'fix', success: true, message: 'Cache invalidated' };
    } catch (err) {
      return { module: 'feature_flags', action: 'fix', success: false, message: (err as Error).message };
    }
  }

  private async fixCollector(): Promise<FixActionResult> {
    try {
      await this.taskRepo.update({}, { lastRunAt: new Date() });
      return { module: 'collector', action: 'fix', success: true, message: 'Reset collector timestamp' };
    } catch (err) {
      return { module: 'collector', action: 'fix', success: false, message: (err as Error).message };
    }
  }
}