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
} from '../../database/entities';
import { KnowledgeBasesController, AgentKnowledgeController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { KnowledgeBasesUploadController } from './knowledge-bases-upload.controller';
import { KnowledgeProcessor } from './knowledge.processor';
import { LlmModule } from '../agents/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeBaseEntity,
      KnowledgeBaseFileEntity,
      KnowledgeBaseChunkEntity,
      AgentKnowledgeBindingEntity,
      AgentEntity,
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
  ],
  controllers: [KnowledgeBasesController, KnowledgeBasesUploadController, AgentKnowledgeController],
  providers: [KnowledgeBasesService, KnowledgeProcessor],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
