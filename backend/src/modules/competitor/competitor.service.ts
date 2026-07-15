import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
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
        ? Math.round((r.stats.total / grandTotal) * 100)
        : 0;
    });

    return {
      period: `${hours}h`,
      competitors: results,
    };
  }

  async getMockComparison(options?: { hours?: number }): Promise<CompetitorComparison> {
    const hours = options?.hours || 24;
    const mockCompetitors = [
      {
        name: '竞品A',
        stats: {
          total: 2847,
          bySentiment: { positive: 1203, negative: 856, neutral: 788 },
          byPlatform: { weibo: 980, weixin: 654, douyin: 523, xiaohongshu: 412, baijiahao: 278 },
          totalEngagement: 289450,
          avgEngagement: 102,
          topKeywords: [
            { keyword: '新品发布', count: 423 },
            { keyword: '用户体验', count: 312 },
            { keyword: '价格争议', count: 267 },
            { keyword: '技术突破', count: 198 },
            { keyword: '市场份额', count: 156 },
          ],
          hourlyTrend: [85, 72, 45, 32, 28, 35, 68, 120, 178, 195, 186, 165, 148, 152, 168, 185, 210, 225, 198, 165, 132, 110, 95, 80],
          sentimentScore: 12,
          shareOfVoice: 35,
        },
      },
      {
        name: '竞品B',
        stats: {
          total: 2135,
          bySentiment: { positive: 356, negative: 1120, neutral: 659 },
          byPlatform: { weibo: 756, weixin: 432, douyin: 389, xiaohongshu: 298, baijiahao: 260 },
          totalEngagement: 456780,
          avgEngagement: 214,
          topKeywords: [
            { keyword: '产品质量', count: 534 },
            { keyword: '售后服务', count: 423 },
            { keyword: '用户投诉', count: 389 },
            { keyword: '监管调查', count: 245 },
            { keyword: '股价下跌', count: 187 },
          ],
          hourlyTrend: [65, 55, 38, 25, 22, 30, 58, 98, 145, 168, 158, 140, 125, 130, 142, 160, 185, 195, 172, 148, 120, 98, 82, 70],
          sentimentScore: -36,
          shareOfVoice: 26,
        },
      },
      {
        name: '竞品C',
        stats: {
          total: 1689,
          bySentiment: { positive: 987, negative: 234, neutral: 468 },
          byPlatform: { weibo: 456, weixin: 523, douyin: 298, xiaohongshu: 234, baijiahao: 178 },
          totalEngagement: 123400,
          avgEngagement: 73,
          topKeywords: [
            { keyword: '创新设计', count: 378 },
            { keyword: '行业奖项', count: 289 },
            { keyword: '用户好评', count: 256 },
            { keyword: '环保理念', count: 198 },
            { keyword: '品牌升级', count: 145 },
          ],
          hourlyTrend: [45, 38, 25, 18, 15, 22, 42, 78, 112, 125, 118, 105, 95, 98, 108, 122, 138, 142, 128, 108, 88, 72, 58, 48],
          sentimentScore: 45,
          shareOfVoice: 21,
        },
      },
      {
        name: '竞品D',
        stats: {
          total: 1456,
          bySentiment: { positive: 634, negative: 445, neutral: 377 },
          byPlatform: { weibo: 534, weixin: 298, douyin: 234, xiaohongshu: 198, baijiahao: 192 },
          totalEngagement: 198700,
          avgEngagement: 137,
          topKeywords: [
            { keyword: '融资消息', count: 312 },
            { keyword: '业务扩张', count: 256 },
            { keyword: '人才招聘', count: 198 },
            { keyword: '战略合作', count: 167 },
            { keyword: '用户增长', count: 134 },
          ],
          hourlyTrend: [55, 42, 28, 20, 16, 25, 48, 85, 120, 138, 130, 115, 102, 108, 118, 135, 152, 158, 140, 118, 95, 78, 62, 52],
          sentimentScore: 13,
          shareOfVoice: 18,
        },
      },
    ];

    return {
      period: `${hours}h`,
      competitors: mockCompetitors,
    };
  }
}
