import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseAdapter } from './base.adapter';
import {
  PlatformAdapter,
  RawOpinionEvent,
  FetchOptions,
  HealthStatus,
} from './platform-adapter.interface';

export const PLATFORM_DECORATOR = Symbol.for('platform.adapter');

@Injectable()
export class AdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>();
  private healthCounters = new Map<string, { failures: number; healthy: boolean }>();

  constructor(private configService: ConfigService) {}

  register(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
    this.healthCounters.set(adapter.platform, { failures: 0, healthy: true });
  }

  get(platform: string): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  list(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  isHealthy(platform: string): boolean {
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
