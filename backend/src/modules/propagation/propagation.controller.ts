import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PropagationService } from './propagation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('propagation')
@UseGuards(JwtAuthGuard)
export class PropagationController {
  constructor(private propagationService: PropagationService) {}

  @Get('graph/:taskId')
  async getGraph(
    @CurrentUser('id') userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
  ) {
    return this.propagationService.getPropagationGraph(userId, taskId, {
      hours: hours ? parseInt(hours, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('graph/:taskId/export')
  async exportGraph(
    @CurrentUser('id') userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
    @Res() res?: Response,
  ) {
    const data = await this.propagationService.getPropagationGraph(userId, taskId, {
      hours: hours ? parseInt(hours, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=propagation-graph-${taskId}.json`);
    res.json(data);
  }

  @Get('demo')
  getDemo() {
    return this.propagationService.getDemoGraph();
  }
}
