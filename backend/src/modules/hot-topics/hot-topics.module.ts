import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HotTopicsController } from './hot-topics.controller';
import { HotTopicsService } from './hot-topics.service';
import { PlatformHotService } from './platform-hot.service';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, MonitorTaskEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [HotTopicsController],
  providers: [HotTopicsService, PlatformHotService],
  exports: [HotTopicsService, PlatformHotService],
})
export class HotTopicsModule {}
