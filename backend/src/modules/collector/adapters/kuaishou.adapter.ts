import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAdapter } from './base.adapter';
import {
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

interface KuaishouVideo {
  id: string;
  title: string;
  desc: string;
  author: string;
  authorAvatar: string;
  videoUrl: string;
  coverUrl: string;
  duration: number;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  hashtags: string[];
  publishedAt: Date;
  comments: Array<{ user: string; content: string; likes: number; time: string }>;
}

const KUAISHOU_VIDEOS: KuaishouVideo[] = [
  {
    id: 'ks_001', title: '农村大集上的炸串摊，看得流口水', desc: '赶大集必吃的炸串，外酥里嫩，太香了！#农村生活 #美食',
    author: '乡村美食家', authorAvatar: 'https://example.com/ks/avatar1.jpg',
    videoUrl: 'https://example.com/kuaishou/v1.mp4', coverUrl: 'https://example.com/ks/cover1.jpg',
    duration: 62, playCount: 560000, likeCount: 78000, commentCount: 8500, shareCount: 12000, collectCount: 9800,
    hashtags: ['农村生活', '美食', '大集'], publishedAt: new Date(Date.now() - 1800000),
    comments: [
      { user: '农村娃', content: '想家了，小时候最爱吃的', likes: 2340, time: '30分钟前' },
      { user: '吃货一枚', content: '看着就好吃，求地址', likes: 1200, time: '1小时前' },
      { user: '在外打工', content: '这就是家乡的味道', likes: 987, time: '2小时前' },
    ],
  },
  {
    id: 'ks_002', title: '大爷用拖拉机耕地，这技术绝了', desc: '老司机的操作，一气呵成！#农村 #农耕',
    author: '田间地头', authorAvatar: 'https://example.com/ks/avatar2.jpg',
    videoUrl: 'https://example.com/kuaishou/v2.mp4', coverUrl: 'https://example.com/ks/cover2.jpg',
    duration: 48, playCount: 380000, likeCount: 52000, commentCount: 6200, shareCount: 8900, collectCount: 4500,
    hashtags: ['农村', '农耕', '技术'], publishedAt: new Date(Date.now() - 5400000),
    comments: [
      { user: '种地能手', content: '这技术没个十年练不出来', likes: 1560, time: '1小时前' },
      { user: '城里人', content: '第一次见耕地，好神奇', likes: 890, time: '2小时前' },
      { user: '农机手', content: '同款拖拉机，确实好用', likes: 678, time: '3小时前' },
    ],
  },
  {
    id: 'ks_003', title: '手工打造一把菜刀，传统锻打工艺', desc: '老铁匠的手艺，一把刀能用一辈子！#手工 #匠心',
    author: '铁匠老张', authorAvatar: 'https://example.com/ks/avatar3.jpg',
    videoUrl: 'https://example.com/kuaishou/v3.mp4', coverUrl: 'https://example.com/ks/cover3.jpg',
    duration: 75, playCount: 720000, likeCount: 95000, commentCount: 11000, shareCount: 18000, collectCount: 22000,
    hashtags: ['手工', '匠心', '传统工艺'], publishedAt: new Date(Date.now() - 10800000),
    comments: [
      { user: '手工爱好者', content: '这才是真正的工匠精神', likes: 3450, time: '30分钟前' },
      { user: '收藏家', content: '这种刀现在很少见了', likes: 2100, time: '1小时前' },
      { user: '厨师', content: '好刀！一把能用几十年', likes: 1567, time: '2小时前' },
    ],
  },
  {
    id: 'ks_004', title: '自家院子种的大西瓜，切开一看太惊喜', desc: '沙瓤大西瓜，比买的甜多了！#农村生活 #西瓜',
    author: '田园生活', authorAvatar: 'https://example.com/ks/avatar4.jpg',
    videoUrl: 'https://example.com/kuaishou/v4.mp4', coverUrl: 'https://example.com/ks/cover4.jpg',
    duration: 40, playCount: 890000, likeCount: 112000, commentCount: 15000, shareCount: 25000, collectCount: 13000,
    hashtags: ['农村生活', '西瓜', '田园'], publishedAt: new Date(Date.now() - 14400000),
    comments: [
      { user: '种菜达人', content: '自己种的确实比买的好吃', likes: 2780, time: '1小时前' },
      { user: '夏天必备', content: '看着就想吃，太解暑了', likes: 1890, time: '2小时前' },
      { user: '农村妹子', content: '我家也种了，快来吃', likes: 1234, time: '3小时前' },
    ],
  },
  {
    id: 'ks_005', title: '村口老大爷的绝活，用树叶吹出美妙音乐', desc: '高手在民间，这水平不输专业歌手！#民间艺人 #绝活',
    author: '民间高手', authorAvatar: 'https://example.com/ks/avatar5.jpg',
    videoUrl: 'https://example.com/kuaishou/v5.mp4', coverUrl: 'https://example.com/ks/cover5.jpg',
    duration: 55, playCount: 650000, likeCount: 87000, commentCount: 9800, shareCount: 16000, collectCount: 11000,
    hashtags: ['民间艺人', '绝活', '高手在民间'], publishedAt: new Date(Date.now() - 21600000),
    comments: [
      { user: '音乐老师', content: '这音准太好了，佩服', likes: 2340, time: '1小时前' },
      { user: '传统文化', content: '民间艺术需要传承', likes: 1987, time: '2小时前' },
      { user: '路人', content: '大爷真有才！', likes: 1432, time: '4小时前' },
    ],
  },
];

@Injectable()
export class KuaishouAdapter extends BaseAdapter {
  readonly platform = 'kuaishou';
  readonly displayName = '快手';
  private readonly logger = new Logger(KuaishouAdapter.name);

  constructor(private configService: ConfigService) {
    super();
  }

  private useMock(): boolean {
    return this.configService.get<boolean>('USE_MOCK', false);
  }

  private get apiBase(): string {
    return this.configService.get<string>('KUAISHOU_API_BASE') || 'https://api.example.com/kuaishou';
  }

  private get apiKey(): string {
    return this.configService.get<string>('KUAISHOU_API_KEY') || '';
  }

  async fetchByKeywords(
    keywords: string[],
    options: FetchOptions,
  ): Promise<RawOpinionEvent[]> {
    if (this.useMock()) {
      return this.generateMockData(keywords, options);
    }

    const params = new URLSearchParams();
    params.append('q', keywords.join(','));
    if (options.since) params.append('since', options.since.toISOString());
    if (options.limit) params.append('limit', String(options.limit));

    try {
      const response = await this.withTimeout(
        fetch(`${this.apiBase}/search?${params.toString()}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }),
        options.timeoutMs || this.defaultTimeout,
      );
      if (!response.ok) return [];
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      return this.buildResult(items as Array<Partial<RawOpinionEvent>>, this.platform);
    } catch (err) {
      this.logger.warn(`Kuaishou fetch failed: ${(err as Error).message}`);
      return this.generateMockData(keywords, options);
    }
  }

  private generateMockData(keywords: string[], options: FetchOptions): RawOpinionEvent[] {
    const results: RawOpinionEvent[] = [];
    const limit = options.limit || 10;
    const matched = KUAISHOU_VIDEOS.filter(v =>
      keywords.some(kw => v.title.includes(kw) || v.desc.includes(kw) || v.hashtags.some(h => h.includes(kw))),
    );
    const pool = matched.length > 0 ? matched : KUAISHOU_VIDEOS;
    for (let i = 0; i < Math.min(limit, pool.length); i++) {
      const v = pool[i];
      results.push({
        platform: this.platform,
        title: v.title,
        content: v.desc,
        author: v.author,
        authorAvatar: v.authorAvatar,
        publishTime: v.publishedAt,
        url: v.videoUrl,
        readCount: v.playCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        shareCount: v.shareCount,
        rawData: {
          videoId: v.id,
          videoUrl: v.videoUrl,
          coverUrl: v.coverUrl,
          durationSeconds: v.duration,
          collectCount: v.collectCount,
          hashtags: v.hashtags,
          comments: v.comments,
          platform: 'kuaishou',
          platformLabel: '快手',
        },
      });
    }
    return results;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (this.useMock()) {
      return { healthy: true, message: 'Mock mode', checkedAt: new Date().toISOString() };
    }
    try {
      const response = await this.withTimeout(
        fetch(`${this.apiBase}/health`, { headers: { Authorization: `Bearer ${this.apiKey}` } }),
        5000,
      );
      return { healthy: response.ok, message: response.ok ? 'OK' : `Status ${response.status}`, checkedAt: new Date().toISOString() };
    } catch (err) {
      return { healthy: false, message: (err as Error).message, checkedAt: new Date().toISOString() };
    }
  }
}
