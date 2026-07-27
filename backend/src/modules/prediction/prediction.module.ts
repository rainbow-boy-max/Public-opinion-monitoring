import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrendPredictionEntity } from '../../database/entities/trend-prediction.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrendPredictionEntity,
      OpinionEventEntity,
    ]),
  ],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
