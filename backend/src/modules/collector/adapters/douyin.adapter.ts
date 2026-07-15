import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAdapter } from './base.adapter';
import {
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

interface DouyinVideo {
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

const DOUYIN_VIDEOS: DouyinVideo[] = [
  {
    id: 'dy_001', title: '这段舞蹈太魔性了！跟着节奏停不下来', desc: '魔性舞蹈挑战，跳完感觉整个人都精神了！#舞蹈 #魔性',
    author: '舞蹈达人小美', authorAvatar: 'https://p3.douyinpic.com/avatar1.jpg',
    videoUrl: 'https://example.com/douyin/v1.mp4', coverUrl: 'https://p3.douyinpic.com/cover1.jpg',
    duration: 45, playCount: 1280000, likeCount: 185000, commentCount: 32000, shareCount: 56000, collectCount: 42000,
    hashtags: ['舞蹈', '魔性', '挑战'], publishedAt: new Date(Date.now() - 3600000),
    comments: [
      { user: '网友小王', content: '太厉害了，这舞跳得真棒！', likes: 2345, time: '1小时前' },
      { user: '爱跳舞的小李', content: '求教程！想学这个舞', likes: 1890, time: '2小时前' },
      { user: '音乐发烧友', content: '背景音乐是什么？好好听', likes: 1523, time: '3小时前' },
      { user: '搞笑达人', content: '笑死了，我也要试试', likes: 987, time: '4小时前' },
    ],
  },
  {
    id: 'dy_002', title: '街头偶遇超帅路人，这颜值绝了！', desc: '今天在街上遇到的，太有气质了！#帅哥 #街拍',
    author: '街拍达人', authorAvatar: 'https://p3.douyinpic.com/avatar2.jpg',
    videoUrl: 'https://example.com/douyin/v2.mp4', coverUrl: 'https://p3.douyinpic.com/cover2.jpg',
    duration: 30, playCount: 2560000, likeCount: 425000, commentCount: 68000, shareCount: 89000, collectCount: 35000,
    hashtags: ['帅哥', '街拍', '颜值'], publishedAt: new Date(Date.now() - 7200000),
    comments: [
      { user: '颜控患者', content: '这也太帅了吧！', likes: 5678, time: '30分钟前' },
      { user: '路人甲', content: '求联系方式！！！', likes: 4321, time: '1小时前' },
      { user: '摄影爱好者', content: '这个光影拍得真好', likes: 2100, time: '2小时前' },
      { user: '柠檬精', content: '呜呜呜为什么我不是长这样', likes: 1567, time: '3小时前' },
    ],
  },
  {
    id: 'dy_003', title: '30秒学会一道拿手菜，简单又好吃', desc: '家常菜做法分享，厨房小白也能轻松搞定！#美食 #家常菜',
    author: '吃货厨房', authorAvatar: 'https://p3.douyinpic.com/avatar3.jpg',
    videoUrl: 'https://example.com/douyin/v3.mp4', coverUrl: 'https://p3.douyinpic.com/cover3.jpg',
    duration: 35, playCount: 890000, likeCount: 123000, commentCount: 18000, shareCount: 45000, collectCount: 67000,
    hashtags: ['美食', '家常菜', '烹饪'], publishedAt: new Date(Date.now() - 10800000),
    comments: [
      { user: '家庭主妇', content: '学到了，今晚试试', likes: 1890, time: '1小时前' },
      { user: '厨房小白', content: '看起来不难，我能做', likes: 1200, time: '2小时前' },
      { user: '美食家', content: '建议加一点老抽上色', likes: 876, time: '3小时前' },
      { user: '减肥达人', content: '热量高吗？', likes: 654, time: '4小时前' },
    ],
  },
  {
    id: 'dy_004', title: '感动！流浪狗被收养前后的变化', desc: '从害怕到信任，这就是爱的力量#流浪狗 #暖心',
    author: '萌宠日记', authorAvatar: 'https://p3.douyinpic.com/avatar4.jpg',
    videoUrl: 'https://example.com/douyin/v4.mp4', coverUrl: 'https://p3.douyinpic.com/cover4.jpg',
    duration: 55, playCount: 3200000, likeCount: 562000, commentCount: 72000, shareCount: 95000, collectCount: 81000,
    hashtags: ['流浪狗', '暖心', '萌宠'], publishedAt: new Date(Date.now() - 14400000),
    comments: [
      { user: '爱狗人士', content: '看哭了，好人一生平安', likes: 8900, time: '20分钟前' },
      { user: '铲屎官', content: '每只狗狗都值得被爱', likes: 6543, time: '1小时前' },
      { user: '动物保护', content: '领养代替购买！', likes: 4321, time: '2小时前' },
      { user: '萌宠控', content: '好可爱的狗狗，想养', likes: 2890, time: '3小时前' },
    ],
  },
  {
    id: 'dy_005', title: '挑战一口气喝完一瓶奶茶，结局亮了', desc: '最后的表情笑死我了！#挑战 #奶茶 #搞笑',
    author: '吃货日常', authorAvatar: 'https://p3.douyinpic.com/avatar5.jpg',
    videoUrl: 'https://example.com/douyin/v5.mp4', coverUrl: 'https://p3.douyinpic.com/cover5.jpg',
    duration: 28, playCount: 1750000, likeCount: 256000, commentCount: 41000, shareCount: 62000, collectCount: 15000,
    hashtags: ['挑战', '奶茶', '搞笑'], publishedAt: new Date(Date.now() - 18000000),
    comments: [
      { user: '奶茶上瘾', content: '哈哈哈最后的表情绝了', likes: 3456, time: '30分钟前' },
      { user: '养生达人', content: '奶茶虽好，可不要贪杯哦', likes: 2345, time: '1小时前' },
      { user: '吃货本货', content: '我也可以挑战！', likes: 1876, time: '2小时前' },
      { user: '糖分焦虑', content: '这一杯多少卡路里啊', likes: 1234, time: '3小时前' },
    ],
  },
];

@Injectable()
export class DouyinAdapter extends BaseAdapter {
  readonly platform = 'douyin';
  readonly displayName = '抖音';
  private readonly logger = new Logger(DouyinAdapter.name);

  constructor(private configService: ConfigService) {
    super();
  }

  private useMock(): boolean {
    return this.configService.get<boolean>('USE_MOCK', false);
  }

  private get apiBase(): string {
    return this.configService.get<string>('DOUYIN_API_BASE') || 'https://api.example.com/douyin';
  }

  private get apiKey(): string {
    return this.configService.get<string>('DOUYIN_API_KEY') || '';
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
      this.logger.warn(`Douyin fetch failed: ${(err as Error).message}`);
      return this.generateMockData(keywords, options);
    }
  }

  private generateMockData(keywords: string[], options: FetchOptions): RawOpinionEvent[] {
    const results: RawOpinionEvent[] = [];
    const limit = options.limit || 10;
    const matched = DOUYIN_VIDEOS.filter(v =>
      keywords.some(kw => v.title.includes(kw) || v.desc.includes(kw) || v.hashtags.some(h => h.includes(kw))),
    );
    const pool = matched.length > 0 ? matched : DOUYIN_VIDEOS;
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
          platform: 'douyin',
          platformLabel: '抖音',
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
