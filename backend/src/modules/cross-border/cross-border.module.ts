import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CrossBorderMonitorService } from './cross-border-monitor.service';
import { CrossBorderController } from './cross-border.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CrossBorderController],
  providers: [CrossBorderMonitorService],
  exports: [CrossBorderMonitorService],
})
export class CrossBorderModule {}