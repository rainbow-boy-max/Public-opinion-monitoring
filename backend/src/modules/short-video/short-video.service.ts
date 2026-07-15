import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ShortVideoEntity } from '../../database/entities';

export interface VideoFilter {
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
  sentiment?: string;
  page?: number;
  pageSize?: number;
}

export interface VideoStats {
  totalVideos: number;
  totalPlays: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number;
  byPlatform: Array<{ platform: string; count: number; avgEngagement: number }>;
  bySentiment: Array<{ sentiment: string; count: number }>;
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  totalPlays: number;
  totalLikes: number;
}

@Injectable()
export class ShortVideoService {
  private readonly logger = new Logger(ShortVideoService.name);

  constructor(
    @InjectRepository(ShortVideoEntity)
    private videoRepo: Repository<ShortVideoEntity>,
  ) {}

  async listVideos(taskId: number, filters: VideoFilter): Promise<{ items: ShortVideoEntity[]; total: number }> {
    const where: Record<string, unknown> = { taskId };
    if (filters.platform && filters.platform !== 'all') {
      where.platform = filters.platform;
    }
    if (filters.sentiment && filters.sentiment !== 'all') {
      where.sentiment = filters.sentiment;
    }
    if (filters.dateFrom && filters.dateTo) {
      where.publishedAt = Between(new Date(filters.dateFrom), new Date(filters.dateTo));
    }
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const [items, total] = await this.videoRepo.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async getVideoStats(taskId: number): Promise<VideoStats> {
    const videos = await this.videoRepo.find({ where: { taskId } });
    const totalVideos = videos.length;
    const totalPlays = videos.reduce((s, v) => s + v.playCount, 0);
    const totalLikes = videos.reduce((s, v) => s + v.likeCount, 0);
    const totalComments = videos.reduce((s, v) => s + v.commentCount, 0);
    const totalShares = videos.reduce((s, v) => s + v.shareCount, 0);
    const totalEngagement = totalLikes + totalComments + totalShares;
    const avgEngagementRate = totalVideos > 0 && totalPlays > 0
      ? parseFloat(((totalEngagement / totalPlays) * 100).toFixed(2))
      : 0;

    const platformMap = new Map<string, { count: number; totalPlays: number; totalLikes: number; totalComments: number; totalShares: number }>();
    const sentimentMap = new Map<string, number>();
    for (const v of videos) {
      const p = platformMap.get(v.platform) || { count: 0, totalPlays: 0, totalLikes: 0, totalComments: 0, totalShares: 0 };
      p.count++;
      p.totalPlays += v.playCount;
      p.totalLikes += v.likeCount;
      p.totalComments += v.commentCount;
      p.totalShares += v.shareCount;
      platformMap.set(v.platform, p);
      sentimentMap.set(v.sentiment, (sentimentMap.get(v.sentiment) || 0) + 1);
    }

    const byPlatform = Array.from(platformMap.entries()).map(([platform, data]) => ({
      platform,
      count: data.count,
      avgEngagement: data.totalPlays > 0
        ? parseFloat((((data.totalLikes + data.totalComments + data.totalShares) / data.totalPlays) * 100).toFixed(2))
        : 0,
    }));

    const bySentiment = Array.from(sentimentMap.entries()).map(([sentiment, count]) => ({
      sentiment,
      count,
    }));

    return {
      totalVideos,
      totalPlays,
      totalLikes,
      totalComments,
      totalShares,
      avgEngagementRate,
      byPlatform,
      bySentiment,
    };
  }

  async getVideoDetail(id: number): Promise<ShortVideoEntity> {
    const video = await this.videoRepo.findOne({ where: { id } });
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }

  async getTopVideos(taskId: number, limit = 10): Promise<ShortVideoEntity[]> {
    return this.videoRepo.find({
      where: { taskId },
      order: { playCount: 'DESC' },
      take: limit,
    });
  }

  async getTrendingHashtags(taskId: number): Promise<TrendingHashtag[]> {
    const videos = await this.videoRepo.find({ where: { taskId } });
    const tagMap = new Map<string, { count: number; totalPlays: number; totalLikes: number }>();
    for (const v of videos) {
      if (!v.hashtags) continue;
      let tags: string[];
      try {
        tags = JSON.parse(v.hashtags) as string[];
      } catch {
        tags = [];
      }
      for (const tag of tags) {
        const entry = tagMap.get(tag) || { count: 0, totalPlays: 0, totalLikes: 0 };
        entry.count++;
        entry.totalPlays += v.playCount;
        entry.totalLikes += v.likeCount;
        tagMap.set(tag, entry);
      }
    }
    return Array.from(tagMap.entries())
      .map(([tag, data]) => ({ tag, ...data }))
      .sort((a, b) => b.count - a.count);
  }
}
