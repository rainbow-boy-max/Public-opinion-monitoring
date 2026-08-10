import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FulltextSearchService } from './fulltext-search.service';
import { FulltextSearchController } from './fulltext-search.controller';
import {
  OpinionEventEntity,
  ShortVideoEntity,
  WorkOrderEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OpinionEventEntity,
      ShortVideoEntity,
      WorkOrderEntity,
    ]),
  ],
  controllers: [FulltextSearchController],
  providers: [FulltextSearchService],
  exports: [FulltextSearchService],
})
export class FulltextSearchModule {}