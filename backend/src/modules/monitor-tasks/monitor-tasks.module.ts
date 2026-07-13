import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MonitorTasksController } from './monitor-tasks.controller';
import { MonitorTasksService } from './monitor-tasks.service';
import { MonitorTaskEntity, OpinionEventEntity } from '../../database/entities';
import { BullQueueModule } from '../../bull-queue/bull-queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitorTaskEntity, OpinionEventEntity]),
    BullModule.registerQueue({
      name: 'task-queue',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 1,
      },
    }),
    BullQueueModule,
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
