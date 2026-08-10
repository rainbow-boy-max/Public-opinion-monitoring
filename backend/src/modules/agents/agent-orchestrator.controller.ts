import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentOrchestratorService } from './agent-orchestrator.service';

@Controller('orchestrator')
@UseGuards(JwtAuthGuard)
export class AgentOrchestratorController {
  constructor(private readonly orchestrator: AgentOrchestratorService) {}

  @Post('analyze/:taskId')
  async analyze(@Param('taskId') taskId: string) {
    return this.orchestrator.runOrchestration(Number(taskId));
  }
}