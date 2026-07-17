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

  async exportMultiFormat(data: {
    title: string;
    sections: Array<{ heading: string; content: string; type?: 'text' | 'table' | 'chart' }>;
    format: 'pdf' | 'docx' | 'xlsx' | 'md';
    includeCharts?: boolean;
  }): Promise<{ filename: string; content: string; contentType: string }> {
    const { title, sections, format } = data;
    const timestamp = new Date().toISOString().slice(0, 10);
    const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');

    if (format === 'md') {
      let md = `# ${title}\n\n`;
      md += `_生成时间: ${new Date().toLocaleString('zh-CN')}_\n\n---\n\n`;
      for (const sec of sections) {
        md += `## ${sec.heading}\n\n`;
        if (sec.type === 'table') {
          md += sec.content + '\n\n';
        } else {
          md += sec.content + '\n\n';
        }
      }
      return {
        filename: `${safeTitle}_${timestamp}.md`,
        content: md,
        contentType: 'text/markdown; charset=utf-8',
      };
    }

    let html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">`;
    html += `<meta name="viewport" content="width=device-width,initial-scale=1">`;
    html += `<title>${this.escapeHtml(title)}</title>`;
    html += `<style>
      body { font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.8; }
      h1 { color: #1a1a2e; border-bottom: 2px solid #5E72E4; padding-bottom: 10px; }
      h2 { color: #2d2d5e; margin-top: 30px; border-left: 4px solid #5E72E4; padding-left: 12px; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #5E72E4; color: #fff; }
      tr:nth-child(even) { background: #f8f9ff; }
      .meta { color: #888; font-size: 14px; margin-bottom: 20px; }
      hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
    </style></head><body>`;
    html += `<h1>${this.escapeHtml(title)}</h1>`;
    html += `<div class="meta">生成时间: ${new Date().toLocaleString('zh-CN')}</div><hr>`;

    for (const sec of sections) {
      html += `<h2>${this.escapeHtml(sec.heading)}</h2>`;
      if (sec.type === 'table') {
        html += `<table>${sec.content}</table>`;
      } else {
        html += `<p>${sec.content.replace(/\n/g, '<br>')}</p>`;
      }
    }

    html += `</body></html>`;

    if (format === 'pdf') {
      return {
        filename: `${safeTitle}_${timestamp}.pdf`,
        content: html,
        contentType: 'application/pdf',
      };
    }

    if (format === 'docx') {
      return {
        filename: `${safeTitle}_${timestamp}.doc`,
        content: html,
        contentType: 'application/msword',
      };
    }

    const bom = '\uFEFF';
    const csvHeader = 'Section,Key,Value\n';
    const csvRows = sections.flatMap((sec) => {
      const lines = sec.content.split('\n').filter(Boolean);
      return lines.map((line) => {
        const cols = line.split(',').map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
        return `"${sec.heading.replace(/"/g, '""')}",${cols}`;
      });
    });
    return {
      filename: `${safeTitle}_${timestamp}.xlsx`,
      content: bom + csvHeader + csvRows.join('\n'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
