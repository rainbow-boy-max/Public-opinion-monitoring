import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, MinLength } from 'class-validator';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class OrchestrateDto {
  @IsString()
  @MinLength(2)
  query: string;
}

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentOrchestratorController {
  constructor(private orchestrator: AgentOrchestratorService) {}

  @Post('orchestrate')
  @HttpCode(HttpStatus.ACCEPTED)
  async orchestrate(
    @CurrentUser('id') userId: number,
    @Body() dto: OrchestrateDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const result = await this.orchestrator.orchestrate(userId, dto.query, (progress) => {
        res.write(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);
      });

      res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      res.write(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`);
    }
    res.end();
  }

  @Get('orchestrate/status/:reportId')
  async getStatus(
    @CurrentUser('id') userId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    const report = await this.orchestrator.getReport(reportId);
    return {
      id: report.id,
      status: report.status,
      analysis: report.analysis,
      strategy: report.strategy,
      modelUsed: report.modelUsed,
      tokensUsed: report.tokensUsed,
      errorMessage: report.errorMessage,
      createdAt: report.createdAt,
    };
  }

  @Post('orchestrate/sync')
  @HttpCode(HttpStatus.OK)
  async orchestrateSync(
    @CurrentUser('id') userId: number,
    @Body() dto: OrchestrateDto,
  ) {
    return this.orchestrator.orchestrate(userId, dto.query);
  }
}
