import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface DouyinVideoSearchParams {
  keyword: string;
  count?: number;
  cursor?: number;
}

interface DouyinVideo {
  itemId: string;
  title: string;
  description: string;
  videoUrl: string;
  coverUrl: string;
  author: {
    uid: string;
    nickname: string;
    avatar: string;
  };
  statistics: {
    likeCount: number;
    commentCount: number;
    shareCount: number;
    playCount: number;
  };
  duration: number;
  createTime: number;
}

@Injectable()
export class DouyinApiClient {
  private readonly logger = new Logger(DouyinApiClient.name);
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly enableRealApi: boolean;

  constructor(private readonly configService: ConfigService) {
    this.appKey = this.configService.get<string>('DOUYIN_APP_KEY', '');
    this.appSecret = this.configService.get<string>('DOUYIN_APP_SECRET', '');
    this.enableRealApi = this.configService.get<boolean>('ENABLE_REAL_API', false);

    if (!this.enableRealApi) {
      this.logger.warn('Running in MOCK mode. Set ENABLE_REAL_API=true to use real Douyin API');
    }
  }

  async searchVideos(params: DouyinVideoSearchParams): Promise<DouyinVideo[]> {
    if (!this.enableRealApi) {
      return this.mockSearchVideos(params);
    }

    // TODO: 替换为真实 API 调用
    throw new Error('Real Douyin API not implemented');
  }

  private mockSearchVideos(params: DouyinVideoSearchParams): DouyinVideo[] {
    this.logger.log(`[MOCK] Searching videos: ${params.keyword}`);
    
    const mockVideos: DouyinVideo[] = [];
    const count = params.count || 10;

    for (let i = 0; i < count; i++) {
      mockVideos.push({
        itemId: `douyin_mock_${Date.now()}_${i}`,
        title: `${params.keyword} - 抖音视频 ${i + 1}`,
        description: `关于 ${params.keyword} 的短视频`,
        videoUrl: `https://mock-cdn.com/video_${i}.mp4`,
        coverUrl: `https://mock-cdn.com/cover_${i}.jpg`,
        author: {
          uid: `author_${i}`,
          nickname: `用户${i}`,
          avatar: `https://mock-cdn.com/avatar_${i}.jpg`,
        },
        statistics: {
          likeCount: Math.floor(Math.random() * 10000),
          commentCount: Math.floor(Math.random() * 1000),
          shareCount: Math.floor(Math.random() * 500),
          playCount: Math.floor(Math.random() * 100000),
        },
        duration: Math.floor(Math.random() * 60) + 15,
        createTime: Date.now() - Math.floor(Math.random() * 86400000),
      });
    }

    return mockVideos;
  }
}
