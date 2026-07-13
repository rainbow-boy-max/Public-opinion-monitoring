import { Global, Module } from '@nestjs/common';
import { redisConfig } from '../config/redis.config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [],
  providers: [RedisService, redisConfig],
  exports: [RedisService],
})
export class RedisModule {}