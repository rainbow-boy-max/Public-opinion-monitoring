import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private timelineService: TimelineService) {}

  @Get(':taskId')
  async getTimeline(
    @CurrentUser('id') userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('hours') hours?: number,
    @Query('groupInterval') groupInterval?: string,
  ) {
    return this.timelineService.getTimeline(userId, taskId, { hours, groupInterval });
  }

  @Get(':taskId/milestones')
  async getMilestones(
    @CurrentUser('id') userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.timelineService.getMilestones(userId, taskId);
  }
}
