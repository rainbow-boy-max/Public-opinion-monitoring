import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  CompetitorGroupEntity,
  OpinionEventEntity,
} from '../../database/entities';

export interface CompetitorConfig {
  name: string;
  keywords: string[];
  platforms: string[];
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  competitors: CompetitorConfig[];
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  competitors?: CompetitorConfig[];
  isActive?: number;
}

export interface CompetitorComparison {
  dataSource?: 'live';
  lastUpdated?: string;
  period: string;
  competitors: Array<{
    name: string;
    stats: {
      total: number;
      bySentiment: { positive: number; negative: number; neutral: number };
      byPlatform: Record<string, number>;
      totalEngagement: number;
      avgEngagement: number;
      topKeywords: Array<{ keyword: string; count: number }>;
      hourlyTrend: number[];
      sentimentScore: number;
      shareOfVoice: number;
    };
  }>;
}

@Injectable()
export class CompetitorService {
  private readonly logger = new Logger(CompetitorService.name);

  constructor(
    @InjectRepository(CompetitorGroupEntity)
    private groupRepo: Repository<CompetitorGroupEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async createGroup(userId: number, dto: CreateGroupDto): Promise<CompetitorGroupEntity> {
    if (!dto.name) throw new BadRequestException('Group name is required');
    if (!dto.competitors || dto.competitors.length === 0) {
      throw new BadRequestException('At least one competitor is required');
    }
    const group = this.groupRepo.create({
      userId,
      name: dto.name,
      description: dto.description || null,
      competitors: JSON.stringify(dto.competitors),
      isActive: 1,
    });
    await this.groupRepo.save(group);
    this.logger.log(`Competitor group created: id=${group.id} userId=${userId}`);
    return group;
  }

  async listGroups(userId: number): Promise<CompetitorGroupEntity[]> {
    return this.groupRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getGroup(userId: number, id: number): Promise<CompetitorGroupEntity> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.userId !== userId) throw new ForbiddenException('Access denied');
    return group;
  }

  async updateGroup(userId: number, id: number, dto: UpdateGroupDto): Promise<CompetitorGroupEntity> {
    const group = await this.getGroup(userId, id);
    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.competitors !== undefined) {
      group.competitors = JSON.stringify(dto.competitors);
    }
    if (dto.isActive !== undefined) group.isActive = dto.isActive;
    await this.groupRepo.save(group);
    this.logger.log(`Competitor group updated: id=${id}`);
    return group;
  }

  async deleteGroup(userId: number, id: number): Promise<void> {
    const group = await this.getGroup(userId, id);
    await this.groupRepo.remove(group);
    this.logger.log(`Competitor group deleted: id=${id}`);
  }

  async getComparison(
    userId: number,
    groupId: number,
    options?: { hours?: number },
  ): Promise<CompetitorComparison> {
    const group = await this.getGroup(userId, groupId);
    const competitors: CompetitorConfig[] = JSON.parse(group.competitors);
    const hours = options?.hours || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const results = await Promise.all(
      competitors.map(async (comp) => {
        const events = await this.eventRepo.find({
          where: {
            matchedAt: MoreThanOrEqual(since),
          },
        });

        const filtered = events.filter((e) => {
          if (!e.matchedKeywords) return false;
          return comp.keywords.some((kw) =>
            e.matchedKeywords.some((mk: string) =>
              mk.toLowerCase().includes(kw.toLowerCase()),
            ),
          );
        });

        const total = filtered.length;
        const bySentiment = { positive: 0, negative: 0, neutral: 0 };
        const byPlatform: Record<string, number> = {};
        let totalEngagement = 0;

        const hourBuckets = new Array(24).fill(0);

        filtered.forEach((e) => {
          if (e.sentiment === 'positive') bySentiment.positive++;
          else if (e.sentiment === 'negative') bySentiment.negative++;
          else bySentiment.neutral++;

          const platform = e.platform || 'unknown';
          byPlatform[platform] = (byPlatform[platform] || 0) + 1;

          totalEngagement +=
            (e.readCount || 0) +
            (e.likeCount || 0) +
            (e.commentCount || 0) +
            (e.shareCount || 0);

          const hoursAgo = Math.floor(
            (Date.now() - new Date(e.matchedAt).getTime()) / (1000 * 60 * 60),
          );
          if (hoursAgo >= 0 && hoursAgo < 24) {
            hourBuckets[23 - hoursAgo]++;
          }
        });

        const keywordCount: Record<string, number> = {};
        filtered.forEach((e) => {
          if (e.matchedKeywords) {
            e.matchedKeywords.forEach((kw: string) => {
              keywordCount[kw] = (keywordCount[kw] || 0) + 1;
            });
          }
        });
        const topKeywords = Object.entries(keywordCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([keyword, count]) => ({ keyword, count }));

        const sentimentScore = total > 0
          ? Math.round(((bySentiment.positive - bySentiment.negative) / total) * 100)
          : 0;

        return {
          name: comp.name,
          stats: {
            total,
            bySentiment,
            byPlatform,
            totalEngagement,
            avgEngagement: total > 0 ? Math.round(totalEngagement / total) : 0,
            topKeywords,
            hourlyTrend: hourBuckets,
            sentimentScore,
            shareOfVoice: 0,
          },
        };
      }),
    );

    const grandTotal = results.reduce((sum, r) => sum + r.stats.total, 0);
    results.forEach((r) => {
      r.stats.shareOfVoice = grandTotal > 0
        ? Math.round((r.stats.total / grandTotal) * 10000) / 100
        : 0;
    });

    return {
      dataSource: 'live',
      lastUpdated: new Date().toISOString(),
      period: `${hours}h`,
      competitors: results,
    };
  }
}
