import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAdapter } from './base.adapter';
import {
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

interface XiaohongshuNote {
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

const XHS_NOTES: XiaohongshuNote[] = [
  {
    id: 'xhs_001', title: '早春穿搭合集｜气质又显瘦的搭配公式', desc: '分享6套超显气质的春季穿搭，每一套都绝绝子！#穿搭 #时尚 #早春',
    author: '时尚博主小A', authorAvatar: 'https://example.com/xhs/avatar1.jpg',
    videoUrl: 'https://example.com/xhs/v1.mp4', coverUrl: 'https://example.com/xhs/cover1.jpg',
    duration: 90, playCount: 450000, likeCount: 89000, commentCount: 6500, shareCount: 28000, collectCount: 52000,
    hashtags: ['穿搭', '时尚', '早春', '气质'], publishedAt: new Date(Date.now() - 3600000),
    comments: [
      { user: '穿搭小白', content: '第二套好好看！求链接', likes: 3450, time: '30分钟前' },
      { user: '时尚达人', content: '学到了，明天就这样穿', likes: 2100, time: '1小时前' },
      { user: '剁手党', content: '全部加购物车了哈哈', likes: 1876, time: '2小时前' },
    ],
  },
  {
    id: 'xhs_002', title: '敏感肌必备！年度最爱护肤品清单', desc: '整理了一年的护肤空瓶，这些都是会回购的好物！#护肤 #敏感肌 #好物推荐',
    author: '护肤研究员', authorAvatar: 'https://example.com/xhs/avatar2.jpg',
    videoUrl: 'https://example.com/xhs/v2.mp4', coverUrl: 'https://example.com/xhs/cover2.jpg',
    duration: 120, playCount: 680000, likeCount: 125000, commentCount: 18000, shareCount: 35000, collectCount: 78000,
    hashtags: ['护肤', '敏感肌', '好物推荐', '空瓶记'], publishedAt: new Date(Date.now() - 7200000),
    comments: [
      { user: '敏感肌患者', content: '同款面霜真的巨好用！', likes: 5670, time: '20分钟前' },
      { user: '成分党', content: '成分分析得很到位，收藏了', likes: 4321, time: '1小时前' },
      { user: '护肤新手', content: '终于找到适合我的了', likes: 2890, time: '2小时前' },
    ],
  },
  {
    id: 'xhs_003', title: '租房改造｜小卧室也能变ins风', desc: '花了500块改造的出租屋，温馨又有格调！#租房改造 #家居 #ins风',
    author: '家居改造家', authorAvatar: 'https://example.com/xhs/avatar3.jpg',
    videoUrl: 'https://example.com/xhs/v3.mp4', coverUrl: 'https://example.com/xhs/cover3.jpg',
    duration: 85, playCount: 520000, likeCount: 98000, commentCount: 12000, shareCount: 22000, collectCount: 65000,
    hashtags: ['租房改造', '家居', 'ins风', '出租屋'], publishedAt: new Date(Date.now() - 10800000),
    comments: [
      { user: '租房党', content: '这也太棒了！我也要改造', likes: 4560, time: '1小时前' },
      { user: '家居控', content: '求所有链接！太好看了', likes: 3210, time: '2小时前' },
      { user: '打工人', content: '500块就搞定了？太厉害', likes: 2345, time: '3小时前' },
    ],
  },
  {
    id: 'xhs_004', title: '减脂餐一周不重样｜好吃又掉秤', desc: '分享我的减脂餐搭配，吃得开心还能瘦！#减脂餐 #健康饮食 #减肥',
    author: '健康饮食日记', authorAvatar: 'https://example.com/xhs/avatar4.jpg',
    videoUrl: 'https://example.com/xhs/v4.mp4', coverUrl: 'https://example.com/xhs/cover4.jpg',
    duration: 70, playCount: 380000, likeCount: 76000, commentCount: 8900, shareCount: 19000, collectCount: 43000,
    hashtags: ['减脂餐', '健康饮食', '减肥', '食谱'], publishedAt: new Date(Date.now() - 14400000),
    comments: [
      { user: '减肥中', content: '跟着做了一个月瘦了5斤！', likes: 6780, time: '1小时前' },
      { user: '厨房小白', content: '看起来很简单，明天试试', likes: 3456, time: '2小时前' },
      { user: '营养师', content: '这个搭配很科学，推荐', likes: 2100, time: '4小时前' },
    ],
  },
  {
    id: 'xhs_005', title: '周末Citywalk｜发现了一家宝藏咖啡店', desc: '藏在胡同里的咖啡店，氛围感满分！#周末去哪儿 #咖啡店 #探店',
    author: '探店小能手', authorAvatar: 'https://example.com/xhs/avatar5.jpg',
    videoUrl: 'https://example.com/xhs/v5.mp4', coverUrl: 'https://example.com/xhs/cover5.jpg',
    duration: 65, playCount: 290000, likeCount: 56000, commentCount: 7200, shareCount: 15000, collectCount: 28000,
    hashtags: ['周末去哪儿', '咖啡店', '探店', 'Citywalk'], publishedAt: new Date(Date.now() - 18000000),
    comments: [
      { user: '咖啡爱好者', content: '这家我去过！咖啡超好喝', likes: 3450, time: '1小时前' },
      { user: '拍照达人', content: '环境也太出片了吧', likes: 2345, time: '2小时前' },
      { user: '周末无聊', content: '收藏了，周末去打卡', likes: 1890, time: '3小时前' },
    ],
  },
];

@Injectable()
export class XiaohongshuAdapter extends BaseAdapter {
  readonly platform = 'xiaohongshu';
  readonly displayName = '小红书';
  private readonly logger = new Logger(XiaohongshuAdapter.name);

  constructor(private configService: ConfigService) {
    super();
  }

  private useMock(): boolean {
    return this.configService.get<boolean>('USE_MOCK', false);
  }

  private get apiBase(): string {
    return this.configService.get<string>('XIAOHONGSHU_API_BASE') || 'https://api.example.com/xhs';
  }

  private get apiKey(): string {
    return this.configService.get<string>('XIAOHONGSHU_API_KEY') || '';
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
      this.logger.warn(`Xiaohongshu fetch failed: ${(err as Error).message}`);
      return this.generateMockData(keywords, options);
    }
  }

  private generateMockData(keywords: string[], options: FetchOptions): RawOpinionEvent[] {
    const results: RawOpinionEvent[] = [];
    const limit = options.limit || 10;
    const matched = XHS_NOTES.filter(v =>
      keywords.some(kw => v.title.includes(kw) || v.desc.includes(kw) || v.hashtags.some(h => h.includes(kw))),
    );
    const pool = matched.length > 0 ? matched : XHS_NOTES;
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
          noteId: v.id,
          videoUrl: v.videoUrl,
          coverUrl: v.coverUrl,
          durationSeconds: v.duration,
          collectCount: v.collectCount,
          hashtags: v.hashtags,
          comments: v.comments,
          platform: 'xiaohongshu',
          platformLabel: '小红书',
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
