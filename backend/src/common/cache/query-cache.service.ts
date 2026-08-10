import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          /* fall through to loader */
        }
      }
    } catch (err) {
      this.logger.warn(`cache read failed: ${(err as Error).message}`);
    }

    const value = await loader();

    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache write failed: ${(err as Error).message}`);
    }

    return value;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`cache invalidate failed: ${(err as Error).message}`);
    }
  }
}
