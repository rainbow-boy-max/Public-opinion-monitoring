import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformAdapter,
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';
import { WeiboAdapter } from './weibo.adapter';
import { WeixinAdapter } from './weixin.adapter';
import { DouyinAdapter } from './douyin.adapter';
import { XiaohongshuAdapter } from './xiaohongshu.adapter';
import { KuaishouAdapter } from './kuaishou.adapter';
import { BaijiahaoAdapter } from './baijiahao.adapter';
import { WeixinVideoAdapter } from './weixin-video.adapter';
import { MockAdapter } from './mock.adapter';

export const PLATFORM_DECORATOR = Symbol.for('platform.adapter');

@Injectable()
export class AdapterRegistry implements OnModuleInit {
  private readonly logger = new Logger(AdapterRegistry.name);
  private adapters = new Map<string, PlatformAdapter>();
  private healthCounters = new Map<string, { failures: number; healthy: boolean }>();

  private readonly useMock: boolean;

  constructor(
    private configService: ConfigService,
    private weibo: WeiboAdapter,
    private weixin: WeixinAdapter,
    private weixinVideo: WeixinVideoAdapter,
    private douyin: DouyinAdapter,
    private xiaohongshu: XiaohongshuAdapter,
    private kuaishou: KuaishouAdapter,
    private baijiahao: BaijiahaoAdapter,
    private mock: MockAdapter,
  ) {
    this.useMock = this.configService.get<boolean>('USE_MOCK', false);
  }

  onModuleInit(): void {
    this.register(this.weibo);
    this.register(this.weixin);
    this.register(this.weixinVideo);
    this.register(this.douyin);
    this.register(this.xiaohongshu);
    this.register(this.kuaishou);
    this.register(this.baijiahao);
    this.register(this.mock);
    this.logger.log(`Registered ${this.adapters.size} platform adapters`);
    if (this.useMock) {
      this.logger.warn('MOCK mode enabled - all platforms will return mock data');
    }
  }

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
    this.healthCounters.set(adapter.platform, { failures: 0, healthy: true });
  }

  get(platform: string): PlatformAdapter | undefined {
    const adapter = this.adapters.get(platform);
    if (adapter) return adapter;
    if (this.useMock) return this.mock;
    return undefined;
  }

  list(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  isHealthy(platform: string): boolean {
    if (platform === 'mock') return true;
    const counter = this.healthCounters.get(platform);
    return counter?.healthy ?? true;
  }

  markFailure(platform: string): void {
    const counter = this.healthCounters.get(platform) || { failures: 0, healthy: true };
    counter.failures += 1;
    if (counter.failures >= 3) {
      counter.healthy = false;
      this.healthCounters.set(platform, counter);
    }
  }

  markSuccess(platform: string): void {
    this.healthCounters.set(platform, { failures: 0, healthy: true });
  }
}
