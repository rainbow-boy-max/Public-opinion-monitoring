import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OpinionEventEntity, AlertLogEntity } from '../../database/entities';

export interface DutyOverview {
  totalEvents: number;
  alertCount: number;
  criticalAlerts: number;
  latestEvents: Array<{ id: number; title: string; platform: string; sentiment: string; matchedAt: Date }>;
  platformBreakdown: Record<string, number>;
  sentimentTrend: { positive: number; negative: number; neutral: number };
  topKeywords: string[];
}

@Injectable()
export class DutyService {
  private readonly logger = new Logger(DutyService.name);

  constructor(
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(AlertLogEntity) private alertRepo: Repository<AlertLogEntity>,
  ) {}

  async getDutyOverview(userId: number): Promise<DutyOverview> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = await this.eventRepo.find({
      where: { matchedAt: Between(last24h, now) },
      order: { matchedAt: 'DESC' },
    });

    const totalEvents = recentEvents.length;

    const alerts = await this.alertRepo.find({
      where: { createdAt: Between(last24h, now) },
    });
    const alertCount = alerts.length;

    const criticalAlerts = alerts.filter(a => a.status === 'sent').length;

    const latestEvents = recentEvents.slice(0, 10).map(e => ({
      id: e.id,
      title: e.title,
      platform: e.platform,
      sentiment: e.sentiment,
      matchedAt: e.matchedAt,
    }));

    const platformBreakdown: Record<string, number> = {};
    for (const e of recentEvents) {
      platformBreakdown[e.platform] = (platformBreakdown[e.platform] || 0) + 1;
    }

    let positive = 0, negative = 0, neutral = 0;
    for (const e of recentEvents) {
      if (e.sentiment === 'positive') positive++;
      else if (e.sentiment === 'negative') negative++;
      else neutral++;
    }
    const sentimentTrend = { positive, negative, neutral };

    const keywordMap = new Map<string, number>();
    for (const e of recentEvents) {
      if (e.matchedKeywords) {
        for (const kw of e.matchedKeywords) {
          keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1);
        }
      }
    }
    const topKeywords = [...keywordMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw]) => kw);

    return {
      totalEvents,
      alertCount,
      criticalAlerts,
      latestEvents,
      platformBreakdown,
      sentimentTrend,
      topKeywords,
    };
  }
}
