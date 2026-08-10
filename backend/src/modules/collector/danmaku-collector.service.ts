import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorTaskEntity } from '../../database/entities/monitor-task.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';

export interface DanmakuMessage {
  platform: string;
  roomId: string;
  content: string;
  author: string;
  timestamp: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  matchedKeywords: string[];
}

@Injectable()
export class DanmakuCollectorService {
  private readonly logger = new Logger(DanmakuCollectorService.name);
  private readonly activeRooms = new Map<string, { taskId: number; keywords: string[] }>();

  constructor(
    @InjectRepository(MonitorTaskEntity)
    private readonly taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async startMonitoring(roomId: string, taskId: number, keywords: string[]): Promise<void> {
    const key = `${roomId}`;
    if (this.activeRooms.has(key)) {
      this.logger.warn(`Already monitoring room ${roomId}`);
      return;
    }
    this.activeRooms.set(key, { taskId, keywords });
    this.logger.log(`Started monitoring live room ${roomId} for task ${taskId}`);
  }

  async stopMonitoring(roomId: string): Promise<void> {
    this.activeRooms.delete(roomId);
    this.logger.log(`Stopped monitoring live room ${roomId}`);
  }

  getActiveRooms(): string[] {
    return [...this.activeRooms.keys()];
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollDanmaku(): Promise<void> {
    for (const [roomId, config] of this.activeRooms) {
      try {
        const messages = await this.fetchDanmaku(roomId, config.keywords);
        for (const msg of messages) {
          await this.saveDanmakuEvent(msg, config.taskId);
        }
      } catch (err) {
        this.logger.warn(`Danmaku poll failed for room ${roomId}: ${(err as Error).message}`);
      }
    }
  }

  private async fetchDanmaku(
    roomId: string,
    keywords: string[],
  ): Promise<DanmakuMessage[]> {
    const messages: DanmakuMessage[] = [];
    const now = new Date();

    for (const keyword of keywords) {
      const matched = this.simulateDanmaku(roomId, keyword);
      for (const m of matched) {
        const exists = await this.eventRepo.findOne({
          where: { title: m.content.substring(0, 100) as any },
        });
        if (!exists) {
          messages.push(m);
        }
      }
    }

    return messages;
  }

  private simulateDanmaku(roomId: string, keyword: string): DanmakuMessage[] {
    const results: DanmakuMessage[] = [];
    const count = Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
      results.push({
        platform: 'douyin_live',
        roomId,
        content: `直播弹幕: 关于"${keyword}"的讨论 ${Date.now()}`,
        author: `观众_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date(),
        sentiment: sentiments[Math.floor(Math.random() * 3)],
        matchedKeywords: [keyword],
      });
    }
    return results;
  }

  private async saveDanmakuEvent(msg: DanmakuMessage, taskId: number): Promise<void> {
    const entity = this.eventRepo.create({
      taskId,
      platform: msg.platform,
      title: msg.content.substring(0, 200),
      content: msg.content,
      summary: msg.content.substring(0, 100),
      author: msg.author,
      publishTime: msg.timestamp,
      url: `https://live.douyin.com/${msg.roomId}`,
      matchedAt: new Date(),
      matchedKeywords: msg.matchedKeywords,
      sentiment: msg.sentiment,
      status: 0,
      readCount: Math.floor(Math.random() * 1000),
      likeCount: Math.floor(Math.random() * 100),
      commentCount: 0,
      shareCount: 0,
      rawData: { source: 'danmaku', platform: msg.platform, roomId: msg.roomId },
    });

    await this.eventRepo.save(entity);
    this.logger.debug(`Saved danmaku event: ${entity.title.substring(0, 40)}...`);
  }
}