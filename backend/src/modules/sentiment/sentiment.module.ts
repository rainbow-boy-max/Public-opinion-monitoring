import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpinionEventEntity } from '../../database/entities';
import { SentimentAnalysisService } from './sentiment.service';
import { SentimentController } from './sentiment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OpinionEventEntity])],
  controllers: [SentimentController],
  providers: [SentimentAnalysisService],
  exports: [SentimentAnalysisService],
})
export class SentimentModule {}
