import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';

export interface TimelineNode {
  id: number;
  title: string;
  platform: string;
  author: string;
  publishTime: Date;
  matchedAt: Date;
  sentiment: string;
  readCount: number;
  likeCount: number;
  commentCount: number;
  url: string;
  isOrigin: boolean;
}

export interface TimelineBranch {
  platform: string;
  nodes: TimelineNode[];
  totalCount: number;
}

export interface EventTimeline {
  eventId: number;
  eventTitle: string;
  origin: TimelineNode | null;
  branches: TimelineBranch[];
  totalEvents: number;
  peakHour: string;
  peakCount: number;
}

@Injectable()
export class EventTimelineService {
  private readonly logger = new Logger(EventTimelineService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async buildTimeline(taskId: number, hours = 72): Promise<EventTimeline> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const events = await this.eventRepo.find({
      where: { taskId, matchedAt: cutoff as any },
      order: { publishTime: 'ASC' },
    });

    if (events.length === 0) {
      return {
        eventId: taskId,
        eventTitle: '',
        origin: null,
        branches: [],
        totalEvents: 0,
        peakHour: '',
        peakCount: 0,
      };
    }

    const origin = events[0];
    const byPlatform = new Map<string, TimelineNode[]>();

    for (const e of events) {
      const node = this.toNode(e, e.id === origin.id);
      const list = byPlatform.get(e.platform) || [];
      list.push(node);
      byPlatform.set(e.platform, list);
    }

    const branches: TimelineBranch[] = [];
    for (const [platform, nodes] of byPlatform) {
      branches.push({ platform, nodes, totalCount: nodes.length });
    }
    branches.sort((a, b) => b.totalCount - a.totalCount);

    const hourlyCount = new Map<string, number>();
    for (const e of events) {
      const hour = this.hourKey(e.matchedAt);
      hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1);
    }
    let peakHour = '';
    let peakCount = 0;
    for (const [hour, count] of hourlyCount) {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
      }
    }

    return {
      eventId: taskId,
      eventTitle: origin.title || '',
      origin: this.toNode(origin, true),
      branches,
      totalEvents: events.length,
      peakHour,
      peakCount,
    };
  }

  private toNode(e: OpinionEventEntity, isOrigin: boolean): TimelineNode {
    return {
      id: e.id,
      title: e.title,
      platform: e.platform,
      author: e.author,
      publishTime: e.publishTime,
      matchedAt: e.matchedAt,
      sentiment: e.sentiment,
      readCount: e.readCount,
      likeCount: e.likeCount,
      commentCount: e.commentCount,
      url: e.url,
      isOrigin,
    };
  }

  private hourKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:00`;
  }
}