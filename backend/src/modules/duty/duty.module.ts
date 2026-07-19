import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyGateway } from './duty.gateway';
import { DutyService } from './duty.service';
import { DutyController } from './duty.controller';
import { OpinionEventEntity, AlertRuleEntity, MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, AlertRuleEntity, MonitorTaskEntity]),
  ],
  controllers: [DutyController],
  providers: [DutyGateway, DutyService],
  exports: [DutyService],
})
export class DutyModule {}
