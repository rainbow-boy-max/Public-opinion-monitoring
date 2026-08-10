import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpinionEventEntity, LlmModelEntity, AlertLogEntity, AlertRuleEntity } from '../../database/entities';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { IndustryKnowledgeService } from './industry-knowledge.service';
import { IndustryKnowledgeController } from './industry-knowledge.controller';
import { KgWarningService } from './kg-warning.service';
import { AlertRuleService } from '../alert/alert-rule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, LlmModelEntity, AlertLogEntity, AlertRuleEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [KnowledgeGraphController, IndustryKnowledgeController],
  providers: [KnowledgeGraphService, KgWarningService, AlertRuleService, IndustryKnowledgeService],
  exports: [KnowledgeGraphService, KgWarningService],
})
export class KnowledgeGraphModule {}
