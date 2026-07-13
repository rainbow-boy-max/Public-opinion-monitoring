import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST') || process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(config.get<string>('REDIS_PORT') || process.env.REDIS_PORT || '6379', 10),
          password: config.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || undefined,
          db: parseInt(config.get<string>('REDIS_DB') || process.env.REDIS_DB || '0', 10),
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullQueueModule {}
