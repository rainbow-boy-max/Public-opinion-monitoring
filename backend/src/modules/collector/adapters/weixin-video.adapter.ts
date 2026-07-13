import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAdapter } from './base.adapter';
import {
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

@Injectable()
export class WeixinVideoAdapter extends BaseAdapter {
  readonly platform = 'weixin_video';
  readonly displayName = '微信视频号';
  private readonly logger = new Logger(WeixinVideoAdapter.name);

  constructor(private configService: ConfigService) {
    super();
  }

  private get apiBase(): string {
    return this.configService.get<string>('WEIXIN_VIDEO_API_BASE') || 'https://api.example.com/wx_video';
  }

  private get apiKey(): string {
    return this.configService.get<string>('WEIXIN_VIDEO_API_KEY') || '';
  }

  async fetchByKeywords(
    keywords: string[],
    options: FetchOptions,
  ): Promise<RawOpinionEvent[]> {
    const params = new URLSearchParams();
    params.append('q', keywords.join(','));
    if (options.since) params.append('since', options.since.toISOString());
    if (options.limit) params.append('limit', String(options.limit));

    const url = `${this.apiBase}/search?${params.toString()}`;
    try {
      const response = await this.withTimeout(
        fetch(url, { headers: { Authorization: `Bearer ${this.apiKey}` } }),
        options.timeoutMs || this.defaultTimeout,
      );

      if (!response.ok) {
        this.logger.warn(`WeixinVideo API returned status ${response.status}`);
        return [];
      }
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      return this.buildResult(items as Array<Partial<RawOpinionEvent>>, this.platform);
    } catch (err) {
      this.logger.warn(`WeixinVideo fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await this.withTimeout(
        fetch(`${this.apiBase}/health`, { headers: { Authorization: `Bearer ${this.apiKey}` } }),
        5000,
      );
      return {
        healthy: response.ok,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        healthy: false,
        message: (err as Error).message,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}