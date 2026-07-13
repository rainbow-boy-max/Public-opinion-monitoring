import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmModelEntity } from '../../database/entities';
import { LlmService } from './llm.service';
import { LlmRouterService } from './llm-router.service';
import { LlmModelsController } from './llm-models.controller';
import { LlmModelsService } from './llm-models.service';
import { LlmEmbeddingsService } from './llm-embeddings.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([LlmModelEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [LlmModelsController],
  providers: [LlmService, LlmRouterService, LlmModelsService, LlmEmbeddingsService],
  exports: [LlmService, LlmRouterService, LlmModelsService, LlmEmbeddingsService],
})
export class LlmModule {}
