import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EventTimelineService } from './event-timeline.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventTimelineController {
  constructor(private readonly timelineService: EventTimelineService) {}

  @Get(':taskId/timeline')
  async getTimeline(
    @Param('taskId') taskId: string,
    @Query('hours') hours?: number,
  ) {
    return this.timelineService.buildTimeline(Number(taskId), hours || 72);
  }
}