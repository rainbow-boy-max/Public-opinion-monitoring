import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RealtimeGateway } from './realtime.gateway';
import { StatsAggregatorService } from './stats-aggregator.service';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([OpinionEventEntity, MonitorTaskEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  providers: [RealtimeGateway, StatsAggregatorService],
  exports: [RealtimeGateway, StatsAggregatorService],
})
export class RealtimeModule {}
