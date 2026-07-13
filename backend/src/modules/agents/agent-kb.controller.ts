import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { AgentKbService } from './agent-kb.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/agents/:agentId/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AgentKbController {
  constructor(private service: AgentKbService) {}

  @Get('files')
  async listFiles(@Param('agentId', ParseIntPipe) agentId: number) {
    return this.service.listFiles(agentId);
  }

  @Delete('files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    await this.service.deleteFile(agentId, fileId);
  }

  @Get('search')
  async search(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Param('query') query: string,
  ) {
    const hits = await this.service.retrieveRelevant(agentId, query, 4);
    return { hits, count: hits.length };
  }
}
