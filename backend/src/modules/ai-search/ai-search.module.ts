import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AiSearchMonitorService } from './ai-search-monitor.service';
import { AiSearchController } from './ai-search.controller';
import { MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitorTaskEntity]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AiSearchController],
  providers: [AiSearchMonitorService],
  exports: [AiSearchMonitorService],
})
export class AiSearchModule {}