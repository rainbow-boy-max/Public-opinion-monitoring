import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpinionEventEntity, LlmModelEntity } from '../../database/entities';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, LlmModelEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
