import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { OpinionEventEntity, AlertRuleEntity, MonitorTaskEntity } from '../../database/entities';

export interface DutyOverview {
  totalEvents: number;
  alertCount: number;
  criticalAlerts: number;
  latestEvents: Array<{
    id: number;
    title: string;
    platform: string;
    sentiment: string;
    matchedAt: Date;
  }>;
  platformBreakdown: Record<string, number>;
  sentimentTrend: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topKeywords: string[];
}

@Injectable()
export class DutyService {
  private readonly logger = new Logger(DutyService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(AlertRuleEntity)
    private alertRepo: Repository<AlertRuleEntity>,
  ) {}

  async getOverview(): Promise<DutyOverview> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 24h 事件数
    const totalEvents = await this.eventRepo.count({
      where: { matchedAt: MoreThan(oneDayAgo) },
    });

    // 活跃告警数
    const activeAlerts = await this.alertRepo.find({
      where: { isEnabled: 1 },
    });
    const alertCount = activeAlerts.length;
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

    // 最新事件
    const latestEvents = await this.eventRepo.find({
      where: { matchedAt: MoreThan(oneDayAgo) },
      order: { matchedAt: 'DESC' },
      take: 50,
    });

    // 平台分布
    const platformBreakdown: Record<string, number> = {};
    latestEvents.forEach(evt => {
      platformBreakdown[evt.platform] = (platformBreakdown[evt.platform] || 0) + 1;
    });

    // 情感分布
    const sentimentTrend = {
      positive: latestEvents.filter(e => e.sentiment === 'positive').length,
      negative: latestEvents.filter(e => e.sentiment === 'negative').length,
      neutral: latestEvents.filter(e => e.sentiment === 'neutral').length,
    };

    // 热点关键词（简化版）
    const keywords = latestEvents
      .flatMap(e => (e.title || '').split(/\s+/))
      .filter(w => w.length > 1)
      .slice(0, 10);
    const topKeywords = [...new Set(keywords)].slice(0, 8);

    return {
      totalEvents,
      alertCount,
      criticalAlerts,
      latestEvents: latestEvents.slice(0, 30).map(e => ({
        id: e.id,
        title: e.title,
        platform: e.platform,
        sentiment: e.sentiment,
        matchedAt: e.matchedAt,
      })),
      platformBreakdown,
      sentimentTrend,
      topKeywords,
    };
  }
}
