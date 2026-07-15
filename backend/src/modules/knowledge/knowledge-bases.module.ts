import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import {
  KnowledgeBaseEntity,
  KnowledgeBaseFileEntity,
  KnowledgeBaseChunkEntity,
  AgentKnowledgeBindingEntity,
  AgentEntity,
  KbScoringConfigEntity,
} from '../../database/entities';
import { KnowledgeBasesController, AgentKnowledgeController } from './knowledge-bases.controller';
import { KbScoringController } from './kb-scoring.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { KbScoringService } from './kb-scoring.service';
import { KnowledgeBasesUploadController } from './knowledge-bases-upload.controller';
import { KnowledgeProcessor } from './knowledge.processor';
import { LlmModule } from '../agents/llm.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBaseEntity,
      KnowledgeBaseFileEntity,
      KnowledgeBaseChunkEntity,
      AgentKnowledgeBindingEntity,
      AgentEntity,
      KbScoringConfigEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    MulterModule.register({
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
    BullModule.registerQueue({
      name: 'knowledge-parse',
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 2,
      },
    }),
    LlmModule,
    AdminModule,
  ],
  controllers: [
    KnowledgeBasesController,
    KnowledgeBasesUploadController,
    AgentKnowledgeController,
    KbScoringController,
  ],
  providers: [KnowledgeBasesService, KnowledgeProcessor, KbScoringService],
  exports: [KnowledgeBasesService, KbScoringService],
})
export class KnowledgeBasesModule {}
