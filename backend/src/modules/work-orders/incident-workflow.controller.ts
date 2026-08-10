import { Controller, Post, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IncidentWorkflowService } from './incident-workflow.service';

@Controller('incident')
@UseGuards(JwtAuthGuard)
export class IncidentWorkflowController {
  constructor(private readonly workflow: IncidentWorkflowService) {}

  @Post('create/:eventId')
  async createFromEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.workflow.createIncidentFromEvent(eventId, userId);
  }

  @Post('assign/:workOrderId')
  async assign(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body('userId') userId: number,
  ) {
    await this.workflow.autoAssign(workOrderId, userId);
    return { message: `Work order ${workOrderId} assigned to user ${userId}` };
  }

  @Post('complete/:workOrderId')
  async complete(
    @Param('workOrderId', ParseIntPipe) workOrderId: number,
    @Body('feedback') feedback: string,
  ) {
    await this.workflow.completeWithFeedback(workOrderId, feedback);
    return { message: `Work order ${workOrderId} completed` };
  }
}