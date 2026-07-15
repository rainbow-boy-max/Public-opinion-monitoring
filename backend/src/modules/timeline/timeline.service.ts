import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

export interface TimelineEntry {
  time: string;
  total: number;
  byPlatform: Record<string, number>;
  bySentiment: { positive: number; negative: number; neutral: number };
  keywords: string[];
  keyEvents: Array<{
    id: number;
    title: string;
    platform: string;
    author: string;
    sentiment: string;
    engagement: number;
  }>;
  sentimentShift: boolean;
}

export interface TimelineSummary {
  totalEvents: number;
  peakHour: string;
  dominantPlatform: string;
  overallSentiment: string;
  keywords: string[];
}

export interface TimelineResult {
  timeline: TimelineEntry[];
  summary: TimelineSummary;
}

export interface Milestone {
  type: string;
  label: string;
  event: {
    id: number;
    title: string;
    platform: string;
    author: string;
    sentiment: string;
    engagement: number;
    publishTime: string;
  } | null;
}

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  async getTimeline(
    userId: number,
    taskId: number,
    options?: { hours?: number; groupInterval?: string },
  ): Promise<TimelineResult> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    const hours = options?.hours ?? 24;
    const intervalMinutes = this.parseInterval(options?.groupInterval ?? '1h');
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const events = await this.eventRepo.find({
      where: {
        taskId: task.id,
        publishTime: Between(since, now),
      },
      order: { publishTime: 'DESC' },
    });

    if (events.length === 0) {
      return this.generateMockTimeline(task);
    }

    const intervals = this.groupByInterval(events, since, now, intervalMinutes);
    const timeline: TimelineEntry[] = intervals.map((group) =>
      this.buildEntry(group),
    );

    const summary = this.computeSummary(timeline, events);
    return { timeline, summary };
  }

  async getMilestones(
    userId: number,
    taskId: number,
  ): Promise<{ milestones: Milestone[] }> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    const events = await this.eventRepo.find({
      where: { taskId: task.id },
      order: { publishTime: 'DESC' },
    });

    if (events.length === 0) {
      return this.generateMockMilestones();
    }

    const calcEngagement = (e: OpinionEventEntity) =>
      e.readCount + e.likeCount + e.commentCount * 2 + e.shareCount * 3;

    const first = events.reduce((a, b) =>
      a.publishTime < b.publishTime ? a : b,
    );
    const highestEngagement = events.reduce((a, b) =>
      calcEngagement(a) > calcEngagement(b) ? a : b,
    );
    const mostNegative = events
      .filter((e) => e.sentiment === 'negative')
      .sort((a, b) => calcEngagement(b) - calcEngagement(a));
    const mostShared = events.reduce((a, b) =>
      a.shareCount > b.shareCount ? a : b,
    );

    const intervals = this.groupByInterval(
      events,
      new Date(Math.min(...events.map((e) => e.publishTime.getTime()))),
      new Date(Math.max(...events.map((e) => e.publishTime.getTime()))),
      60,
    );
    const peakInterval = intervals.reduce((a, b) =>
      a.length > b.length ? a : b,
    );

    const toMilestoneEvent = (e: OpinionEventEntity) => ({
      id: e.id,
      title: e.title,
      platform: e.platform,
      author: e.author,
      sentiment: e.sentiment,
      engagement: calcEngagement(e),
      publishTime: e.publishTime.toISOString(),
    });

    const milestones: Milestone[] = [
      { type: 'first', label: '最早事件', event: toMilestoneEvent(first) },
      {
        type: 'peak_engagement',
        label: '最高互动',
        event: toMilestoneEvent(highestEngagement),
      },
      ...(mostNegative.length > 0
        ? [
            {
              type: 'most_negative' as const,
              label: '最负面事件',
              event: toMilestoneEvent(mostNegative[0]),
            },
          ]
        : []),
      {
        type: 'most_shared',
        label: '传播最广',
        event: toMilestoneEvent(mostShared),
      },
      {
        type: 'peak_volume',
        label: '高峰时段',
        event: peakInterval.length > 0 ? toMilestoneEvent(peakInterval[0]) : null,
      },
    ];

    return { milestones };
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([hmd])$/);
    if (!match) return 60;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'h') return value * 60;
    if (unit === 'd') return value * 1440;
    return value;
  }

  private groupByInterval(
    events: OpinionEventEntity[],
    since: Date,
    until: Date,
    intervalMinutes: number,
  ): OpinionEventEntity[][] {
    const groups: OpinionEventEntity[][] = [];
    const intervalMs = intervalMinutes * 60 * 1000;
    let cursor = new Date(
      Math.floor(since.getTime() / intervalMs) * intervalMs,
    );

    while (cursor < until) {
      const next = new Date(cursor.getTime() + intervalMs);
      const group = events.filter(
        (e) => e.publishTime >= cursor && e.publishTime < next,
      );
      groups.push(group);
      cursor = next;
    }

    return groups;
  }

  private buildEntry(events: OpinionEventEntity[]): TimelineEntry {
    const byPlatform: Record<string, number> = {};
    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    const keywordFreq: Record<string, number> = {};

    for (const e of events) {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
      bySentiment[e.sentiment as keyof typeof bySentiment]++;

      if (e.matchedKeywords) {
        for (const kw of e.matchedKeywords) {
          keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
        }
      }
    }

    const sorted = [...events].sort(
      (a, b) =>
        b.readCount +
        b.likeCount +
        b.commentCount * 2 +
        b.shareCount * 3 -
        (a.readCount + a.likeCount + a.commentCount * 2 + a.shareCount * 3),
    );

    const keywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    const keyEvents = sorted.slice(0, 3).map((e) => ({
      id: e.id,
      title: e.title,
      platform: e.platform,
      author: e.author,
      sentiment: e.sentiment,
      engagement:
        e.readCount + e.likeCount + e.commentCount * 2 + e.shareCount * 3,
    }));

    const time =
      events.length > 0
        ? new Date(
            Math.floor(events[0].publishTime.getTime() / (60 * 60 * 1000)) *
              60 *
              60 *
              1000,
          ).toISOString()
        : new Date().toISOString();

    return {
      time,
      total: events.length,
      byPlatform,
      bySentiment,
      keywords,
      keyEvents,
      sentimentShift: false,
    };
  }

  private computeSummary(
    timeline: TimelineEntry[],
    allEvents: OpinionEventEntity[],
  ): TimelineSummary {
    const totalEvents = allEvents.length;
    const peak = timeline.reduce((a, b) => (a.total > b.total ? a : b), timeline[0]);

    const platformTotals: Record<string, number> = {};
    const sentimentTotals = { positive: 0, negative: 0, neutral: 0 };
    const keywordFreq: Record<string, number> = {};

    for (const e of allEvents) {
      platformTotals[e.platform] = (platformTotals[e.platform] || 0) + 1;
      sentimentTotals[e.sentiment as keyof typeof sentimentTotals]++;
      if (e.matchedKeywords) {
        for (const kw of e.matchedKeywords) {
          keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
        }
      }
    }

    const dominantPlatform = Object.entries(platformTotals).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] || 'unknown';

    const overallSentiment = sentimentTotals.positive > sentimentTotals.negative
      ? 'positive'
      : sentimentTotals.negative > sentimentTotals.positive
        ? 'negative'
        : 'neutral';

    const keywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);

    return {
      totalEvents,
      peakHour: peak?.time || '',
      dominantPlatform,
      overallSentiment,
      keywords,
    };
  }

  private generateMockTimeline(task: MonitorTaskEntity): TimelineResult {
    const platforms = ['weixin', 'douyin', 'weibo', 'xiaohongshu', 'kuaishou', 'baijiahao'];
    const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
    const sampleTitles = [
      '相关话题引发广泛讨论',
      '行业专家发表深度分析',
      '网友热议最新进展',
      '官方回应引发关注',
      '媒体集中报道事件',
    ];

    const now = new Date();
    const timeline: TimelineEntry[] = [];

    let prevSentiment: string | null = null;

    for (let i = 11; i >= 0; i--) {
      const hourTime = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
      const hourStr = new Date(
        Math.floor(hourTime.getTime() / (60 * 60 * 1000)) * 60 * 60 * 1000,
      ).toISOString();

      const platformCount = Math.floor(Math.random() * 4) + 1;
      const shuffledPlatforms = [...platforms].sort(() => Math.random() - 0.5);
      const activePlatforms = shuffledPlatforms.slice(0, platformCount);

      const byPlatform: Record<string, number> = {};
      const bySentiment = { positive: 0, negative: 0, neutral: 0 };
      const total = Math.floor(Math.random() * 15) + 3;

      for (const p of activePlatforms) {
        byPlatform[p] = Math.floor(Math.random() * 5) + 1;
      }

      const dominantSent = sentiments[Math.floor(Math.random() * 3)];
      bySentiment[dominantSent] = Math.ceil(total * 0.5);
      const remaining = total - bySentiment[dominantSent];
      const secondSent = sentiments.find((s) => s !== dominantSent)!;
      bySentiment[secondSent] = Math.ceil(remaining * 0.6);
      bySentiment[ sentiments.find((s) => s !== dominantSent && s !== secondSent)! ] =
        total - bySentiment[dominantSent] - bySentiment[secondSent];

      const sentimentShift = prevSentiment !== null && dominantSent !== prevSentiment;
      prevSentiment = dominantSent;

      const keyEvents = shuffledPlatforms.slice(0, 3).map((p, idx) => ({
        id: i * 3 + idx + 1,
        title: sampleTitles[Math.floor(Math.random() * sampleTitles.length)],
        platform: p,
        author: `用户${String.fromCharCode(65 + idx)}`,
        sentiment: sentiments[Math.floor(Math.random() * 3)],
        engagement: Math.floor(Math.random() * 10000) + 500,
      }));

      const allKeywords = ['热点话题', '行业趋势', '公众反应', '政策影响', '市场动态', '技术创新', '用户反馈', '媒体报道'];
      const kwCount = Math.floor(Math.random() * 4) + 2;
      const keywords = [...allKeywords].sort(() => Math.random() - 0.5).slice(0, kwCount);

      timeline.push({
        time: hourStr,
        total,
        byPlatform,
        bySentiment,
        keywords,
        keyEvents,
        sentimentShift,
      });
    }

    const summary: TimelineSummary = {
      totalEvents: timeline.reduce((s, t) => s + t.total, 0),
      peakHour: timeline.reduce((a, b) => (a.total > b.total ? a : b)).time,
      dominantPlatform: 'weibo',
      overallSentiment: 'neutral',
      keywords: ['热点话题', '行业趋势', '公众反应', '政策影响', '市场动态', '技术创新', '用户反馈', '媒体报道'],
    };

    return { timeline, summary };
  }

  private generateMockMilestones(): { milestones: Milestone[] } {
    const now = new Date();
    const milestones: Milestone[] = [
      {
        type: 'first',
        label: '最早事件',
        event: {
          id: 1,
          title: '话题首次出现在微博平台',
          platform: 'weibo',
          author: '用户A',
          sentiment: 'neutral',
          engagement: 3200,
          publishTime: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        type: 'peak_engagement',
        label: '最高互动',
        event: {
          id: 5,
          title: '相关讨论达到互动峰值',
          platform: 'douyin',
          author: '大V用户',
          sentiment: 'positive',
          engagement: 45600,
          publishTime: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        type: 'most_negative',
        label: '最负面事件',
        event: {
          id: 8,
          title: '负面评论集中爆发',
          platform: 'weibo',
          author: '用户C',
          sentiment: 'negative',
          engagement: 28900,
          publishTime: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        type: 'most_shared',
        label: '传播最广',
        event: {
          id: 12,
          title: '深度分析文章被广泛转发',
          platform: 'weixin',
          author: '行业观察者',
          sentiment: 'neutral',
          engagement: 38500,
          publishTime: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        type: 'peak_volume',
        label: '高峰时段',
        event: {
          id: 15,
          title: '讨论量达到顶峰',
          platform: 'weibo',
          author: '多方用户',
          sentiment: 'negative',
          engagement: 21000,
          publishTime: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        },
      },
    ];
    return { milestones };
  }
}
