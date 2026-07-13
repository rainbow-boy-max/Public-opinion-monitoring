import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorTasksController } from './monitor-tasks.controller';
import { MonitorTasksService } from './monitor-tasks.service';
import { MonitorTaskEntity, OpinionEventEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([MonitorTaskEntity, OpinionEventEntity])],
  controllers: [MonitorTasksController],
  providers: [MonitorTasksService],
  exports: [MonitorTasksService],
})
export class MonitorTasksModule {}
