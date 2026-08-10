import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovBriefingEntity } from '../../database/entities/gov-briefing.entity';
import { LeaderInstructionEntity } from '../../database/entities/leader-instruction.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { GovMonitorSiteEntity, GovMonitorChangeEntity } from '../../database/entities/gov-monitor-site.entity';
import { LlmModule } from '../agents/llm.module';
import { GovReportController } from './gov-report.controller';
import { GovBriefingService } from './gov-briefing.service';
import { LeaderInstructionService } from './leader-instruction.service';
import { GovBriefingExportService } from './gov-briefing-export.service';
import { GovSubmitService } from './gov-submit.service';
import { GovMonitorService } from './gov-monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GovBriefingEntity,
      LeaderInstructionEntity,
      OpinionEventEntity,
      GovMonitorSiteEntity,
      GovMonitorChangeEntity,
    ]),
    LlmModule,
  ],
  controllers: [GovReportController],
  providers: [
    GovBriefingService,
    LeaderInstructionService,
    GovBriefingExportService,
    GovSubmitService,
    GovMonitorService,
  ],
  exports: [
    GovBriefingService,
    LeaderInstructionService,
    GovBriefingExportService,
    GovSubmitService,
    GovMonitorService,
  ],
})
export class GovReportModule {}
