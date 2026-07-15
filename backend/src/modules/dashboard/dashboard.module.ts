import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CustomDashboardEntity, OpinionEventEntity } from '../../database/entities';
import { HotTopicsModule } from '../hot-topics/hot-topics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomDashboardEntity, OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    HotTopicsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
