import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EcommerceConfigEntity } from '../../database/entities';

export interface ReviewItem {
  platform: string;
  productName: string;
  rating: number;
  content: string;
  author: string;
  date: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface BrandMention {
  platform: string;
  source: string;
  content: string;
  date: string;
  mentionCount: number;
}

export interface EcommerceStats {
  totalReviews: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  negativeRatio: number;
  trendingProducts: Array<{ name: string; reviewCount: number; avgRating: number }>;
}

const MOCK_REVIEWS: ReviewItem[] = [
  { platform: 'jd', productName: '智能手表Pro', rating: 5, content: '非常满意，续航能力强，功能全面，佩戴舒适', author: '张***明', date: '2026-07-15', sentiment: 'positive' },
  { platform: 'jd', productName: '智能手表Pro', rating: 3, content: '功能还可以，但续航不如宣传那么好', author: '李***华', date: '2026-07-14', sentiment: 'neutral' },
  { platform: 'jd', productName: '智能手表Pro', rating: 1, content: '收到就有划痕，退货处理中', author: '王***丽', date: '2026-07-12', sentiment: 'negative' },
  { platform: 'taobao', productName: '智能手表Pro', rating: 4, content: '性价比不错，物流很快，包装精美', author: '淘***客', date: '2026-07-13', sentiment: 'positive' },
  { platform: 'taobao', productName: '智能手表Pro', rating: 2, content: '表带质量一般，用了两周就变色了', author: '购***家', date: '2026-07-10', sentiment: 'negative' },
  { platform: 'pdd', productName: '智能手表Pro', rating: 4, content: '这个价格很值，功能齐全', author: '拼***君', date: '2026-07-11', sentiment: 'positive' },
  { platform: 'jd', productName: '无线蓝牙耳机', rating: 5, content: '音质超出预期，降噪效果很好', author: '音***控', date: '2026-07-15', sentiment: 'positive' },
  { platform: 'taobao', productName: '无线蓝牙耳机', rating: 4, content: '佩戴舒适，连接稳定，续航不错', author: '耳***迷', date: '2026-07-14', sentiment: 'positive' },
  { platform: 'pdd', productName: '无线蓝牙耳机', rating: 3, content: '一般般，低频不够饱满', author: '听***者', date: '2026-07-09', sentiment: 'neutral' },
  { platform: 'jd', productName: '智能摄像头', rating: 5, content: '清晰度很高，夜视效果也很棒，APP好用', author: '安***控', date: '2026-07-13', sentiment: 'positive' },
  { platform: 'jd', productName: '智能摄像头', rating: 1, content: '经常离线，客服态度很差', author: '监***者', date: '2026-07-08', sentiment: 'negative' },
  { platform: 'taobao', productName: '智能摄像头', rating: 2, content: '安装复杂，说明书不清晰', author: '用***A', date: '2026-07-07', sentiment: 'negative' },
  { platform: 'pdd', productName: '智能摄像头', rating: 4, content: '价格实惠，基本功能都有', author: '拼***B', date: '2026-07-06', sentiment: 'positive' },
];

const MOCK_BRAND_MENTIONS: BrandMention[] = [
  { platform: 'jd', source: '商品问答', content: '这个品牌的售后怎么样？', date: '2026-07-15', mentionCount: 12 },
  { platform: 'taobao', source: '买家评论', content: '支持国产品牌，质量越来越好了', date: '2026-07-14', mentionCount: 8 },
  { platform: 'pdd', source: '拼团讨论', content: '品牌知名度还需提升', date: '2026-07-13', mentionCount: 5 },
  { platform: 'jd', source: '商品评价', content: '和某大牌比差距不大，性价比高', date: '2026-07-12', mentionCount: 15 },
  { platform: 'taobao', source: '直播弹幕', content: '这个牌子最近很火啊', date: '2026-07-11', mentionCount: 20 },
];

@Injectable()
export class EcommerceService {
  private readonly logger = new Logger(EcommerceService.name);

  constructor(
    @InjectRepository(EcommerceConfigEntity)
    private configRepo: Repository<EcommerceConfigEntity>,
  ) {}

  async getConfigs(userId: number): Promise<EcommerceConfigEntity[]> {
    return this.configRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createConfig(userId: number, dto: { platform: string; keywords: string; productIds?: string; isActive?: boolean }): Promise<EcommerceConfigEntity> {
    const config = this.configRepo.create({
      userId,
      platform: dto.platform,
      keywords: dto.keywords,
      productIds: dto.productIds || '',
      isActive: dto.isActive !== false ? 1 : 0,
    });
    return this.configRepo.save(config);
  }

  async updateConfig(userId: number, id: number, dto: { platform?: string; keywords?: string; productIds?: string; isActive?: boolean }): Promise<EcommerceConfigEntity> {
    const config = await this.configRepo.findOne({ where: { id, userId } });
    if (!config) throw new NotFoundException('配置不存在');
    if (dto.platform !== undefined) config.platform = dto.platform;
    if (dto.keywords !== undefined) config.keywords = dto.keywords;
    if (dto.productIds !== undefined) config.productIds = dto.productIds;
    if (dto.isActive !== undefined) config.isActive = dto.isActive ? 1 : 0;
    return this.configRepo.save(config);
  }

  async deleteConfig(userId: number, id: number): Promise<void> {
    const config = await this.configRepo.findOne({ where: { id, userId } });
    if (!config) throw new NotFoundException('配置不存在');
    await this.configRepo.remove(config);
  }

  async getProductReviews(userId: number, filters?: { platform?: string; sentiment?: string }): Promise<ReviewItem[]> {
    const configs = await this.getConfigs(userId);
    const keywords = configs.flatMap((c) => {
      try { return JSON.parse(c.keywords) as string[]; } catch { return [c.keywords]; }
    });
    let reviews = MOCK_REVIEWS;
    if (keywords.length > 0) {
      reviews = reviews.filter((r) =>
        keywords.some((k) => r.productName.includes(k) || r.content.includes(k)),
      );
    }
    if (filters?.platform) {
      reviews = reviews.filter((r) => r.platform === filters.platform);
    }
    if (filters?.sentiment) {
      reviews = reviews.filter((r) => r.sentiment === filters.sentiment);
    }
    return reviews;
  }

  async getBrandMentions(userId: number): Promise<BrandMention[]> {
    const configs = await this.getConfigs(userId);
    const keywords = configs.flatMap((c) => {
      try { return JSON.parse(c.keywords) as string[]; } catch { return [c.keywords]; }
    });
    let mentions = MOCK_BRAND_MENTIONS;
    if (keywords.length > 0) {
      mentions = mentions.filter((m) =>
        keywords.some((k) => m.content.includes(k)),
      );
    }
    return mentions;
  }

  async getStats(userId: number): Promise<EcommerceStats> {
    const reviews = await this.getProductReviews(userId);
    const positiveCount = reviews.filter((r) => r.sentiment === 'positive').length;
    const negativeCount = reviews.filter((r) => r.sentiment === 'negative').length;
    const neutralCount = reviews.filter((r) => r.sentiment === 'neutral').length;
    const productMap = new Map<string, { count: number; totalRating: number }>();
    for (const r of reviews) {
      const entry = productMap.get(r.productName) || { count: 0, totalRating: 0 };
      entry.count++;
      entry.totalRating += r.rating;
      productMap.set(r.productName, entry);
    }
    const trendingProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, reviewCount: data.count, avgRating: Math.round((data.totalRating / data.count) * 10) / 10 }))
      .sort((a, b) => b.reviewCount - a.reviewCount);

    return {
      totalReviews: reviews.length,
      positiveCount,
      negativeCount,
      neutralCount,
      negativeRatio: reviews.length > 0 ? Math.round((negativeCount / reviews.length) * 10000) / 100 : 0,
      trendingProducts,
    };
  }
}
