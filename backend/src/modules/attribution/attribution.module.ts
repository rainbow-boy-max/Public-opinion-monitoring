import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributionAnalysisEntity } from '../../database/entities/attribution-analysis.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { AttributionService } from './attribution.service';
import { AttributionController } from './attribution.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttributionAnalysisEntity,
      OpinionEventEntity,
    ]),
    AgentsModule,
  ],
  controllers: [AttributionController],
  providers: [AttributionService],
  exports: [AttributionService],
})
export class AttributionModule {}
