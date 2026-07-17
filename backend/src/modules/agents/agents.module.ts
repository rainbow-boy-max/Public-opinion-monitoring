import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import {
  AgentEntity,
  AgentKbFileEntity,
  AgentKbChunkEntity,
  PrReportEntity,
  OpinionEventEntity,
  ReportScheduleEntity,
  AgentTemplateEntity,
  MonitorTaskEntity,
  PropagationLinkEntity,
} from '../../database/entities';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentTemplateController } from './agent-template.controller';
import { AgentTemplateService } from './agent-template.service';
import { AgentKbController } from './agent-kb.controller';
import { AgentKbService } from './agent-kb.service';
import { AgentKbProcessor } from './agent-kb.processor';
import { AgentKbUploadController } from './agent-kb-upload.controller';
import { PrReportsController } from './pr-reports.controller';
import { PrReportsService } from './pr-reports.service';
import { AgentOrchestratorController } from './agent-orchestrator.controller';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { LlmModule } from './llm.module';
import { AdminModule } from '../admin/admin.module';
import { KnowledgeBasesModule } from '../knowledge/knowledge-bases.module';
import { WebSearchModule } from '../admin/web-search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentKbFileEntity,
      AgentKbChunkEntity,
      PrReportEntity,
      OpinionEventEntity,
      ReportScheduleEntity,
      AgentTemplateEntity,
      MonitorTaskEntity,
      PropagationLinkEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
    BullModule.registerQueue({
      name: 'agent-kb',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 2,
      },
    }),
    LlmModule,
    AdminModule,
    KnowledgeBasesModule,
    WebSearchModule,
  ],
  controllers: [
    AgentsController,
    AgentKbController,
    AgentKbUploadController,
    PrReportsController,
    AgentTemplateController,
    AgentOrchestratorController,
  ],
  providers: [
    AgentsService,
    AgentKbService,
    AgentKbProcessor,
    PrReportsService,
    AgentTemplateService,
    AgentOrchestratorService,
  ],
  exports: [AgentsService, AgentKbService, PrReportsService, AgentTemplateService, AgentOrchestratorService],
})
export class AgentsModule {}
