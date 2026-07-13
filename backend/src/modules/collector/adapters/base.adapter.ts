import {
  PlatformAdapter,
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

export abstract class BaseAdapter implements PlatformAdapter {
  abstract readonly platform: string;
  abstract readonly displayName: string;

  protected readonly defaultTimeout = 10000;

  abstract fetchByKeywords(
    keywords: string[],
    options: FetchOptions,
  ): Promise<RawOpinionEvent[]>;

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      message: 'Default healthy',
      checkedAt: new Date().toISOString(),
    };
  }

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Adapter request timeout')), timeoutMs),
      ),
    ]);
  }

  protected buildResult(
    items: Array<Partial<RawOpinionEvent>>,
    platform: string,
  ): RawOpinionEvent[] {
    return items.map((item) => ({
      platform,
      title: item.title || '',
      content: item.content || '',
      author: item.author || 'unknown',
      authorAvatar: item.authorAvatar,
      publishTime: item.publishTime || new Date(),
      url: item.url || '',
      readCount: item.readCount || 0,
      likeCount: item.likeCount || 0,
      commentCount: item.commentCount || 0,
      shareCount: item.shareCount || 0,
      rawData: item.rawData || {},
    }));
  }
}
