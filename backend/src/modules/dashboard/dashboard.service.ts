import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CustomDashboardEntity, OpinionEventEntity } from '../../database/entities';
import { HotTopicsService } from '../hot-topics/hot-topics.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(CustomDashboardEntity)
    private dashboardRepo: Repository<CustomDashboardEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private hotTopicsService: HotTopicsService,
  ) {}

  async findAll(userId: number): Promise<CustomDashboardEntity[]> {
    return this.dashboardRepo.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  async findOne(userId: number, id: number): Promise<CustomDashboardEntity> {
    const dashboard = await this.dashboardRepo.findOne({ where: { id, userId } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    return dashboard;
  }

  async create(userId: number, data: { name: string; layout?: string; widgets?: string; isDefault?: number }): Promise<CustomDashboardEntity> {
    const count = await this.dashboardRepo.count({ where: { userId } });
    const dashboard = this.dashboardRepo.create({
      userId,
      name: data.name,
      layout: data.layout || '{}',
      widgets: data.widgets || '[]',
      isDefault: count === 0 ? 1 : (data.isDefault ?? 0),
    });
    if (dashboard.isDefault) {
      await this.dashboardRepo.update({ userId, isDefault: 1 }, { isDefault: 0 });
    }
    return this.dashboardRepo.save(dashboard);
  }

  async update(userId: number, id: number, data: { name?: string; layout?: string; widgets?: string; isDefault?: number }): Promise<CustomDashboardEntity> {
    const dashboard = await this.findOne(userId, id);
    if (data.name !== undefined) dashboard.name = data.name;
    if (data.layout !== undefined) dashboard.layout = data.layout;
    if (data.widgets !== undefined) dashboard.widgets = data.widgets;
    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        await this.dashboardRepo.update({ userId, isDefault: 1 }, { isDefault: 0 });
      }
      dashboard.isDefault = data.isDefault;
    }
    return this.dashboardRepo.save(dashboard);
  }

  async updateLayout(userId: number, id: number, layout: string): Promise<CustomDashboardEntity> {
    const dashboard = await this.findOne(userId, id);
    dashboard.layout = layout;
    return this.dashboardRepo.save(dashboard);
  }

  async remove(userId: number, id: number): Promise<void> {
    const dashboard = await this.findOne(userId, id);
    await this.dashboardRepo.remove(dashboard);
  }

  async getWidgetData(userId: number, widgetType: string, config: Record<string, any> = {}): Promise<any> {
    switch (widgetType) {
      case 'sentiment_trend': return this.getSentimentTrend(userId, config);
      case 'platform_breakdown': return this.getPlatformBreakdown(userId, config);
      case 'volume_over_time': return this.getVolumeOverTime(userId, config);
      case 'top_keywords': return this.getTopKeywords(userId, config);
      case 'recent_events': return this.getRecentEvents(userId, config);
      case 'sentiment_gauge': return this.getSentimentGauge(userId, config);
      case 'hot_topics': return this.getHotTopics(userId, config);
      default: throw new NotFoundException(`Unknown widget type: ${widgetType}`);
    }
  }

  private getTimeRange(config: Record<string, any>): { start: Date; end: Date } {
    const range = config.timeRange || '24h';
    const end = new Date();
    let hours = 24;
    if (range === '6h') hours = 6;
    else if (range === '7d') hours = 168;
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    return { start, end };
  }

  private async getSentimentTrend(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
      order: { matchedAt: 'ASC' },
    });

    const hourlyMap = new Map<string, { positive: number; negative: number; neutral: number }>();
    for (let i = 0; i < 24; i++) {
      const h = new Date(end.getTime() - (23 - i) * 60 * 60 * 1000);
      const label = `${String(h.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(label, { positive: 0, negative: 0, neutral: 0 });
    }

    for (const e of events) {
      const h = new Date(e.matchedAt);
      const label = `${String(h.getHours()).padStart(2, '0')}:00`;
      const entry = hourlyMap.get(label);
      if (entry) {
        if (e.sentiment === 'positive') entry.positive++;
        else if (e.sentiment === 'negative') entry.negative++;
        else entry.neutral++;
      }
    }

    const categories = [...hourlyMap.keys()];
    const positive = categories.map(k => hourlyMap.get(k)!.positive);
    const negative = categories.map(k => hourlyMap.get(k)!.negative);
    const neutral = categories.map(k => hourlyMap.get(k)!.neutral);

    return { categories, series: [{ name: '正面', data: positive }, { name: '负面', data: negative }, { name: '中性', data: neutral }] };
  }

  private async getPlatformBreakdown(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
    });

    const platformMap = new Map<string, number>();
    for (const e of events) {
      platformMap.set(e.platform, (platformMap.get(e.platform) || 0) + 1);
    }

    const data = [...platformMap.entries()].map(([name, value]) => ({ name, value }));
    return { data };
  }

  private async getVolumeOverTime(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
      order: { matchedAt: 'ASC' },
    });

    const hourlyMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      const h = new Date(end.getTime() - (23 - i) * 60 * 60 * 1000);
      const label = `${String(h.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(label, 0);
    }

    for (const e of events) {
      const h = new Date(e.matchedAt);
      const label = `${String(h.getHours()).padStart(2, '0')}:00`;
      hourlyMap.set(label, (hourlyMap.get(label) || 0) + 1);
    }

    const categories = [...hourlyMap.keys()];
    const data = categories.map(k => hourlyMap.get(k)!);
    return { categories, data };
  }

  private async getTopKeywords(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
    });

    const keywordMap = new Map<string, number>();
    for (const e of events) {
      if (e.matchedKeywords) {
        for (const kw of e.matchedKeywords) {
          keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1);
        }
      }
    }

    const sorted = [...keywordMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([text, count]) => ({ text, count }));
    return { data: sorted };
  }

  private async getRecentEvents(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
      order: { matchedAt: 'DESC' },
      take: 20,
    });

    return {
      data: events.map(e => ({
        id: e.id,
        title: e.title,
        platform: e.platform,
        sentiment: e.sentiment,
        matchedAt: e.matchedAt,
        url: e.url,
      })),
    };
  }

  private async getSentimentGauge(userId: number, config: Record<string, any>): Promise<any> {
    const { start, end } = this.getTimeRange(config);
    const events = await this.eventRepo.find({
      where: { matchedAt: Between(start, end) },
    });

    let score = 50;
    if (events.length > 0) {
      const pos = events.filter(e => e.sentiment === 'positive').length;
      const neg = events.filter(e => e.sentiment === 'negative').length;
      const total = events.length;
      score = Math.round(((pos / total) * 100 + (1 - neg / total) * 50) / 1.5);
      score = Math.max(0, Math.min(100, score));
    }

    return { value: score, min: 0, max: 100 };
  }

  private async getHotTopics(userId: number, config: Record<string, any>): Promise<any> {
    try {
      const topics = await this.hotTopicsService.getHotTopics(userId, {
        windowHours: 24,
        minMentions: 2,
        topN: 5,
      });
      return { data: topics };
    } catch (err) {
      this.logger.error('Failed to fetch hot topics', err);
      return { data: [] };
    }
  }
}
