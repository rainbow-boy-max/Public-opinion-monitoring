import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MonitorTaskEntity,
  OpinionEventEntity,
  TaskStatus,
} from '../../database/entities';
import { KeywordMatcherService } from './keyword-matcher.service';
import { OpinionNormalizerService } from './opinion-normalizer.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { RawOpinionEvent } from './adapters/platform-adapter.interface';
import { RedisService } from '../../redis/redis.service';
import { TaskFrequency } from '../../database/entities';

interface TaskJobData {
  taskId: number;
  userId: number;
  keywords: string[];
  excludeKeywords: string[];
  platforms: string[];
  matchMode: 'exact' | 'fuzzy' | 'both';
}

@Injectable()
export class CollectorService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CollectorService.name);
  private timerHandles = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectQueue('task-queue') private taskQueue: Queue<TaskJobData>,
    @InjectRepository(MonitorTaskEntity) private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
    private adapterRegistry: AdapterRegistry,
    private keywordMatcher: KeywordMatcherService,
    private normalizer: OpinionNormalizerService,
    private redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    setTimeout(() => this.loadAndScheduleTasks(), 5000);
  }

  async onApplicationShutdown(): Promise<void> {
    for (const handle of this.timerHandles.values()) {
      clearInterval(handle);
    }
    try {
      await this.taskQueue.close();
    } catch (err) {
      // ignore
    }
  }

  async loadAndScheduleTasks(): Promise<void> {
    try {
      const tasks = await this.taskRepo.find({
        where: { status: TaskStatus.ENABLED },
      });
      for (const task of tasks) {
        await this.scheduleTask(task);
      }
      this.logger.log(`Loaded ${tasks.length} enabled tasks for monitoring`);
    } catch (err) {
      this.logger.error(`Failed to load tasks: ${(err as Error).message}`);
    }
  }

  async scheduleTask(task: MonitorTaskEntity): Promise<void> {
    this.unscheduleTask(task.id);
    const intervalMs = this.frequencyToMs(task.frequency);

    const handle = setInterval(async () => {
      await this.enqueueCollection(task.id);
    }, intervalMs);
    this.timerHandles.set(task.id, handle);

    await this.enqueueCollection(task.id);
  }

  unscheduleTask(taskId: number): void {
    const handle = this.timerHandles.get(taskId);
    if (handle) {
      clearInterval(handle);
      this.timerHandles.delete(taskId);
    }
  }

  async enqueueCollection(taskId: number): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task || task.status !== TaskStatus.ENABLED) return;

    const { keywords, excludeKeywords } = this.parseTaskKeywords(task);
    const matchMode =
      task.matchMode === 'exact'
        ? 'exact'
        : task.matchMode === 'fuzzy'
          ? 'fuzzy'
          : 'both';

    await this.taskQueue.add(
      'collect',
      {
        taskId: task.id,
        userId: task.userId,
        keywords,
        excludeKeywords,
        platforms: task.platforms,
        matchMode,
      },
      {
        jobId: `task-${task.id}-${Date.now()}`,
      },
    );
  }

  async processJob(job: Job<TaskJobData>): Promise<void> {
    const { taskId, userId, keywords, excludeKeywords, platforms, matchMode } = job.data;
    const allRaw: Array<{ platform: string; raw: any }> = [];

    for (const platform of platforms) {
      const adapter = this.adapterRegistry.get(platform);
      if (!adapter) {
        this.logger.warn(`No adapter for platform ${platform}`);
        continue;
      }
      if (!this.adapterRegistry.isHealthy(platform)) {
        this.logger.warn(`Adapter for ${platform} is unhealthy, skipping`);
        continue;
      }
      try {
        const raw = await adapter.fetchByKeywords(keywords, {
          since: new Date(Date.now() - 60 * 60 * 1000),
          limit: 100,
          timeoutMs: 10000,
        });
        this.adapterRegistry.markSuccess(platform);
        for (const r of raw) allRaw.push({ platform, raw: r });
      } catch (err) {
        this.adapterRegistry.markFailure(platform);
        this.logger.warn(`Adapter ${platform} failed: ${(err as Error).message}`);
        const fallback = this.getMockFallback(platform, keywords, {
          since: new Date(Date.now() - 60 * 60 * 1000),
          limit: 100,
        });
        for (const r of fallback) allRaw.push({ platform, raw: r });
      }
    }

    let savedCount = 0;
    for (const { raw } of allRaw) {
      const text = (raw.title || '') + ' ' + (raw.content || '');
      const matchResult = this.keywordMatcher.match({
        text,
        keywords,
        excludeKeywords,
        matchMode,
      });
      if (!matchResult.matched) continue;

      const urlHash = Buffer.from(raw.url || '').toString('base64').substring(0, 64);
      const dedupeKey = `bloom:event:${taskId}:${raw.platform}:${urlHash}`;
      const alreadySeen = await this.redisService.exists(dedupeKey);
      if (alreadySeen) continue;
      await this.redisService.set(dedupeKey, '1', 900);

      const entity = this.normalizer.normalize(raw, taskId, matchResult.matchedKeywords);
      if (!entity) continue;

      const saved = await this.eventRepo.save(entity);
      savedCount++;
      await this.publishNewOpinion(userId, taskId, saved);
    }

    await this.taskRepo.update(taskId, { lastRunAt: new Date() });
    this.logger.debug(
      `Task ${taskId}: collected ${allRaw.length} raw, saved ${savedCount} matched`,
    );
  }

  private getMockFallback(
    platform: string,
    keywords: string[],
    options: { since?: Date; limit?: number },
  ): RawOpinionEvent[] {
    const results: RawOpinionEvent[] = [];
    const now = new Date();
    const count = options.limit && options.limit < 5 ? options.limit : 5;
    for (let i = 0; i < count; i++) {
      const publishedAt = new Date(now.getTime() - Math.random() * 86400000);
      results.push({
        platform,
        title: `[${platform}模拟] 关于 "${keywords.join(',')}" 的第 ${i + 1} 条结果`,
        content: `这是一条来自 ${platform} 的模拟舆情数据，关键词为：${keywords.join('、')}。因真实 API 不可用，使用模拟数据作为替代。`,
        author: `模拟作者_${platform}_${i + 1}`,
        authorAvatar: '',
        publishTime: publishedAt,
        url: `https://example.com/${platform}/mock/${i}`,
        readCount: Math.floor(Math.random() * 10000),
        likeCount: Math.floor(Math.random() * 1000),
        commentCount: Math.floor(Math.random() * 500),
        shareCount: Math.floor(Math.random() * 200),
        rawData: { source: 'mock', platform, keywords, isFallback: true },
      });
    }
    return results;
  }

  private async publishNewOpinion(
    userId: number,
    taskId: number,
    event: OpinionEventEntity,
  ): Promise<void> {
    const payload = {
      userId,
      taskId,
      eventId: event.id,
      eventData: {
        id: event.id,
        platform: event.platform,
        title: event.title,
        summary: event.summary,
        author: event.author,
        publishTime: event.publishTime,
        url: event.url,
        readCount: event.readCount,
        likeCount: event.likeCount,
        sentiment: event.sentiment,
        matchedKeywords: event.matchedKeywords,
      },
      publishedAt: new Date().toISOString(),
    };

    await this.redisService.publish('pubsub:opinion:new', JSON.stringify(payload));
  }

  private parseTaskKeywords(task: MonitorTaskEntity): {
    keywords: string[];
    excludeKeywords: string[];
  } {
    try {
      const keywords = JSON.parse(task.keywords) as string[];
      const excludeKeywords = task.excludeKeywords
        ? (JSON.parse(task.excludeKeywords) as string[])
        : [];
      return { keywords, excludeKeywords };
    } catch {
      return { keywords: [], excludeKeywords: [] };
    }
  }

  private frequencyToMs(frequency: TaskFrequency): number {
    switch (frequency) {
      case TaskFrequency.FIVE_MIN:
        return 5 * 60 * 1000;
      case TaskFrequency.FIFTEEN_MIN:
        return 15 * 60 * 1000;
      case TaskFrequency.THIRTY_MIN:
        return 30 * 60 * 1000;
      case TaskFrequency.SIXTY_MIN:
        return 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runHealthChecks(): Promise<void> {
    for (const adapter of this.adapterRegistry.list()) {
      try {
        const status = await adapter.healthCheck();
        if (status.healthy) {
          this.adapterRegistry.markSuccess(adapter.platform);
        } else {
          this.adapterRegistry.markFailure(adapter.platform);
        }
      } catch (err) {
        this.adapterRegistry.markFailure(adapter.platform);
      }
    }
  }
}
