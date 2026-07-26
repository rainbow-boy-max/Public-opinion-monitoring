import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportGenerationEntity } from '../../database/entities/report-generation.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { ReportGenerationService } from './report-generation.service';
import { ReportGenerationController } from './report-generation.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportGenerationEntity,
      OpinionEventEntity,
    ]),
    AgentsModule,
  ],
  controllers: [ReportGenerationController],
  providers: [ReportGenerationService],
  exports: [ReportGenerationService],
})
export class ReportGenerationModule {}
