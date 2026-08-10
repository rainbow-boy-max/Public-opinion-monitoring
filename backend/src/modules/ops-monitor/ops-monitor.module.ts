import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { OpsMonitorService } from './ops-monitor.service';
import { OpsMonitorController } from './ops-monitor.controller';
import { MonitorTaskEntity } from '../../database/entities';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitorTaskEntity]),
    BullModule.registerQueue({ name: 'task-queue' }),
    FeatureFlagsModule,
  ],
  controllers: [OpsMonitorController],
  providers: [OpsMonitorService],
  exports: [OpsMonitorService],
})
export class OpsMonitorModule {}