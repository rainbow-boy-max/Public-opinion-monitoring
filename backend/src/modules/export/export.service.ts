import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

export interface ExportEventsOptions {
  startDate?: string;
  endDate?: string;
  sentiment?: string;
  platform?: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  async exportEvents(
    taskId: number,
    userId: number,
    format: 'csv' | 'json',
    options?: ExportEventsOptions,
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    const where: any = { taskId, status: 0 };
    if (options?.startDate || options?.endDate) {
      const start = options.startDate ? new Date(options.startDate) : new Date('2000-01-01');
      const end = options.endDate ? new Date(options.endDate) : new Date();
      where.matchedAt = Between(start, end);
    }
    if (options?.sentiment) {
      where.sentiment = options.sentiment;
    }
    if (options?.platform) {
      where.platform = options.platform;
    }

    const events = await this.eventRepo.find({
      where,
      order: { matchedAt: 'DESC' },
    });

    const taskName = task.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const bom = '\uFEFF';
      const header = 'platform,title,author,publishTime,sentiment,readCount,likeCount,commentCount,shareCount,url,matchedKeywords\n';
      const rows = events.map((e) => {
        const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
        return [
          e.platform,
          escape(e.title),
          escape(e.author),
          e.publishTime?.toISOString?.() || '',
          e.sentiment,
          e.readCount,
          e.likeCount,
          e.commentCount,
          e.shareCount,
          escape(e.url),
          escape(Array.isArray(e.matchedKeywords) ? e.matchedKeywords.join(';') : ''),
        ].join(',');
      });
      return {
        filename: `events_${taskName}_${timestamp}.csv`,
        content: bom + header + rows.join('\n'),
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    return {
      filename: `events_${taskName}_${timestamp}.json`,
      content: JSON.stringify(events, null, 2),
      mimeType: 'application/json; charset=utf-8',
    };
  }

  async exportTasks(
    userId: number,
    format: 'csv' | 'json',
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const tasks = await this.taskRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const bom = '\uFEFF';
      const header = 'id,name,keywords,platforms,frequency,status,lastRunAt,createdAt\n';
      const rows = tasks.map((t) => {
        const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
        return [
          t.id,
          escape(t.name),
          escape(t.keywords || ''),
          escape((t.platforms || []).join(';')),
          t.frequency,
          t.status,
          t.lastRunAt?.toISOString?.() || '',
          t.createdAt?.toISOString?.() || '',
        ].join(',');
      });
      return {
        filename: `tasks_${timestamp}.csv`,
        content: bom + header + rows.join('\n'),
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    return {
      filename: `tasks_${timestamp}.json`,
      content: JSON.stringify(tasks, null, 2),
      mimeType: 'application/json; charset=utf-8',
    };
  }

  async exportStats(
    userId: number,
    taskIds: number[],
    format: 'csv' | 'json',
    timeRange: string,
  ): Promise<{ filename: string; content: string; mimeType: string }> {
    const tasks = await this.taskRepo.find({
      where: { id: In(taskIds), userId },
    });
    if (tasks.length === 0) throw new NotFoundException('No tasks found');

    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '7d': startDate = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': startDate = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': startDate = new Date(now.getTime() - 90 * 86400000); break;
      default: startDate = new Date(now.getTime() - 7 * 86400000);
    }

    const events = await this.eventRepo.find({
      where: {
        taskId: In(taskIds),
        status: 0,
        matchedAt: Between(startDate, now),
      },
    });

    const totalEvents = events.length;
    const platformBreakdown: Record<string, number> = {};
    const sentimentDistribution: Record<string, number> = {};
    const hourlyTrend: Record<string, number> = {};

    for (const e of events) {
      platformBreakdown[e.platform] = (platformBreakdown[e.platform] || 0) + 1;
      sentimentDistribution[e.sentiment] = (sentimentDistribution[e.sentiment] || 0) + 1;
      const key = e.matchedAt?.toISOString?.()?.slice(0, 10) || 'unknown';
      hourlyTrend[key] = (hourlyTrend[key] || 0) + 1;
    }

    const stats = {
      timeRange,
      totalEvents,
      taskCount: tasks.length,
      platformBreakdown,
      sentimentDistribution,
      dailyTrend: Object.entries(hourlyTrend)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const bom = '\uFEFF';
      const lines: string[] = [];

      lines.push('=== Summary ===');
      lines.push(`TimeRange,${timeRange}`);
      lines.push(`TotalEvents,${totalEvents}`);
      lines.push(`TaskCount,${tasks.length}`);
      lines.push('');

      lines.push('=== Platform Breakdown ===');
      lines.push('Platform,Count');
      for (const [platform, count] of Object.entries(platformBreakdown)) {
        lines.push(`${platform},${count}`);
      }
      lines.push('');

      lines.push('=== Sentiment Distribution ===');
      lines.push('Sentiment,Count');
      for (const [sentiment, count] of Object.entries(sentimentDistribution)) {
        lines.push(`${sentiment},${count}`);
      }
      lines.push('');

      lines.push('=== Daily Trend ===');
      lines.push('Date,Count');
      for (const { date, count } of stats.dailyTrend) {
        lines.push(`${date},${count}`);
      }

      return {
        filename: `stats_${timestamp}.csv`,
        content: bom + lines.join('\n'),
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    return {
      filename: `stats_${timestamp}.json`,
      content: JSON.stringify(stats, null, 2),
      mimeType: 'application/json; charset=utf-8',
    };
  }
}
