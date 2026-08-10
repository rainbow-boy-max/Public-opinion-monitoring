import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventTimelineService } from './event-timeline.service';
import { EventTimelineController } from './event-timeline.controller';
import { OpinionEventEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([OpinionEventEntity])],
  controllers: [EventTimelineController],
  providers: [EventTimelineService],
  exports: [EventTimelineService],
})
export class EventsModule {}