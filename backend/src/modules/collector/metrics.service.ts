import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitorTaskEntity } from '../../database/entities';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;

  constructor(
    @InjectQueue('task-queue') private readonly taskQueue: Queue,
    private readonly redis: RedisService,
    @InjectRepository(MonitorTaskEntity)
    private readonly taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  incrementRequest(): void {
    this.requestCount++;
  }

  incrementError(): void {
    this.errorCount++;
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  async getHealth(): Promise<Record<string, any>> {
    const checks: Record<string, any> = {
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
    };

    // Redis health
    try {
      const ping = await this.redis.client.ping();
      checks.redis = ping === 'PONG' ? 'ok' : 'degraded';
    } catch {
      checks.redis = 'down';
    }

    // Bull queue health
    try {
      const [waiting, active, delayed, failed] = await Promise.all([
        this.taskQueue.getWaitingCount(),
        this.taskQueue.getActiveCount(),
        this.taskQueue.getDelayedCount(),
        this.taskQueue.getFailedCount(),
      ]);
      checks.bullQueue = {
        waiting,
        active,
        delayed,
        failed,
        status: failed > 10 ? 'degraded' : 'ok',
      };
    } catch {
      checks.bullQueue = { status: 'down' };
    }

    // DB health (count tasks)
    try {
      const taskCount = await this.taskRepo.count();
      checks.database = { status: 'ok', taskCount };
    } catch {
      checks.database = { status: 'down' };
    }

    checks.overall = Object.values(checks).every(
      (v) => typeof v === 'object' ? v.status === 'ok' || v.status === 'ok' : v === 'ok',
    )
      ? 'ok'
      : 'degraded';

    return checks;
  }

  async getPrometheusText(): Promise<string> {
    const mem = process.memoryUsage();
    const lines: string[] = [];

    lines.push('# HELP process_uptime_seconds Total uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${this.getUptime()}`);

    lines.push('# HELP http_requests_total Total HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.requestCount}`);

    lines.push('# HELP http_errors_total Total HTTP request errors');
    lines.push('# TYPE http_errors_total counter');
    lines.push(`http_errors_total ${this.errorCount}`);

    lines.push('# HELP process_memory_bytes Process memory usage');
    lines.push('# TYPE process_memory_bytes gauge');
    lines.push(`process_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
    lines.push(`process_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
    lines.push(`process_memory_bytes{type="rss"} ${mem.rss}`);

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.taskQueue.getWaitingCount(),
        this.taskQueue.getActiveCount(),
        this.taskQueue.getCompletedCount(),
        this.taskQueue.getFailedCount(),
        this.taskQueue.getDelayedCount(),
      ]);

      lines.push('# HELP bull_queue_jobs_total Bull queue job counts by state');
      lines.push('# TYPE bull_queue_jobs_total gauge');
      lines.push(`bull_queue_jobs_total{state="waiting"} ${waiting}`);
      lines.push(`bull_queue_jobs_total{state="active"} ${active}`);
      lines.push(`bull_queue_jobs_total{state="completed"} ${completed}`);
      lines.push(`bull_queue_jobs_total{state="failed"} ${failed}`);
      lines.push(`bull_queue_jobs_total{state="delayed"} ${delayed}`);
    } catch (err) {
      this.logger.warn(`Bull queue metrics unavailable: ${(err as Error).message}`);
    }

    try {
      const taskCount = await this.taskRepo.count();
      lines.push('# HELP opinion_tasks_total Total monitoring tasks');
      lines.push('# TYPE opinion_tasks_total gauge');
      lines.push(`opinion_tasks_total ${taskCount}`);
    } catch (err) {
      this.logger.warn(`DB metrics unavailable: ${(err as Error).message}`);
    }

    return lines.join('\n') + '\n';
  }

  async getMetrics(): Promise<Record<string, any>> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.taskQueue.getWaitingCount(),
      this.taskQueue.getActiveCount(),
      this.taskQueue.getCompletedCount(),
      this.taskQueue.getFailedCount(),
      this.taskQueue.getDelayedCount(),
    ]);

    return {
      uptime: this.getUptime(),
      requests: { total: this.requestCount, errors: this.errorCount },
      bullQueue: { waiting, active, completed, failed, delayed },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}