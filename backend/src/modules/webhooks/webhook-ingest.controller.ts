import { Controller, Post, Param, Body, NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import {
  OpinionEventEntity,
  MonitorTaskEntity,
  Sentiment,
  TaskStatus,
} from '../../database/entities';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface IngestPayload {
  platform?: string;
  title: string;
  content?: string;
  url?: string;
  publishTime?: string;
  author?: string;
  matchedKeywords?: string[];
  sentiment?: Sentiment;
  rawData?: Record<string, unknown>;
}

@Controller('webhook-ingest')
export class WebhookIngestController {
  constructor(
    private webhooksService: WebhooksService,
    @InjectRepository(MonitorTaskEntity) private taskRepo: Repository<MonitorTaskEntity>,
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  @Post(':token')
  async ingest(@Param('token') token: string, @Body() body: IngestPayload) {
    let webhook;
    try {
      webhook = await this.webhooksService.getByIngestToken(token);
    } catch {
      throw new NotFoundException('Invalid ingest token');
    }

    if (!body.title) {
      throw new NotFoundException('Missing required field: title');
    }

    const taskIds = await this.webhooksService.getBoundTasks(webhook.id);
    if (taskIds.length === 0) {
      return { message: 'No tasks bound to this webhook' };
    }

    const summary = body.content
      ? body.content.replace(/<[^>]+>/g, '').substring(0, 200)
      : '';

    const savedEvents = [];
    for (const taskId of taskIds) {
      const task = await this.taskRepo.findOne({ where: { id: taskId } });
      if (!task || task.status !== TaskStatus.ENABLED) continue;

      const event = this.eventRepo.create({
        taskId,
        platform: body.platform || 'webhook_ingest',
        title: body.title,
        content: body.content || '',
        summary,
        author: body.author || 'unknown',
        authorAvatar: null,
        publishTime: body.publishTime ? new Date(body.publishTime) : new Date(),
        url: body.url || '',
        readCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        sentiment: body.sentiment || 'neutral',
        matchedKeywords: body.matchedKeywords || [],
        rawData: body.rawData || {},
        status: 0,
        matchedAt: new Date(),
      });
      const saved = await this.eventRepo.save(event);
      savedEvents.push(saved);

      await this.taskRepo.update(task.id, { lastRunAt: new Date() });
    }

    return { message: 'Ingested successfully', eventsCount: savedEvents.length };
  }
}
