import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MonitorTasksController } from './monitor-tasks.controller';
import { MonitorTasksService } from './monitor-tasks.service';
import { MonitorTaskEntity, OpinionEventEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitorTaskEntity, OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [MonitorTasksController],
  providers: [MonitorTasksService],
  exports: [MonitorTasksService],
})
export class MonitorTasksModule {}
