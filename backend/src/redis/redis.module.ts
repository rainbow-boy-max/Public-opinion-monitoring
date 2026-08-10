import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { QueryCacheService } from '../common/cache/query-cache.service';

@Global()
@Module({
  imports: [],
  providers: [RedisService, QueryCacheService],
  exports: [RedisService, QueryCacheService],
})
export class RedisModule {}
