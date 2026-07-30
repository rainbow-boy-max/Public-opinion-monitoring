import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovBriefingEntity } from '../../database/entities/gov-briefing.entity';
import { LeaderInstructionEntity } from '../../database/entities/leader-instruction.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { GovReportController } from './gov-report.controller';
import { GovBriefingService } from './gov-briefing.service';
import { LeaderInstructionService } from './leader-instruction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GovBriefingEntity,
      LeaderInstructionEntity,
      OpinionEventEntity,
    ]),
  ],
  controllers: [GovReportController],
  providers: [GovBriefingService, LeaderInstructionService],
  exports: [GovBriefingService, LeaderInstructionService],
})
export class GovReportModule {}
