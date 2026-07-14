import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KnowledgeBasesService } from './knowledge-bases.service';
import {
  KnowledgeBaseStatus,
} from '../../database/entities';
import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

class CreateKbDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

class UpdateKbDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsIn(['draft', 'processing', 'ready', 'disabled'])
  status?: KnowledgeBaseStatus;
}

class BindKbsDto {
  @IsArray()
  kbIds: number[];
}

@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class KnowledgeBasesController {
  constructor(private service: KnowledgeBasesService) {}

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({ page, pageSize, status, q });
  }

  @Get('available')
  async available() {
    return this.service.listAvailableKbs();
  }

  @Get('search')
  async search(@Query('q') q: string, @Query('topK') topK = 10) {
    return this.service.searchAcrossAllKbs(q || '', Number(topK));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateKbDto,
  ) {
    return this.service.create(dto, userId);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKbDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.delete(id);
  }

  @Get(':id/files')
  async listFiles(@Param('id', ParseIntPipe) id: number) {
    const list = await this.service.listFiles(id);
    return list.map((f) => ({
      id: f.id,
      kbId: f.kbId,
      filename: f.filename,
      fileType: f.fileType,
      fileSize: f.fileSize,
      chunkCount: f.chunkCount,
      totalChars: f.totalChars,
      aiScore: f.aiScore,
      parsedSummary: f.parsedSummary,
      parsedTopics: f.parsedTopics,
      status: f.status,
      errorMessage: f.errorMessage,
      uploadedAt: f.uploadedAt,
      parsedAt: f.parsedAt,
    }));
  }

  @Delete(':id/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    await this.service.deleteFile(id, fileId);
  }

  @Post(':id/auto-classify')
  @HttpCode(HttpStatus.OK)
  async autoClassify(@Param('id', ParseIntPipe) id: number) {
    await this.service.aiAutoClassify(id);
    return this.service.getOne(id);
  }

  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Param('id', ParseIntPipe) id: number) {
    await this.service.refreshKbStats(id);
    return this.service.getOne(id);
  }
}

@Controller('admin/agents/:agentId/knowledge-bases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AgentKnowledgeController {
  constructor(private service: KnowledgeBasesService) {}

  @Get()
  async list(@Param('agentId', ParseIntPipe) agentId: number) {
    return this.service.getAgentKbIds(agentId);
  }

  @Post()
  async bind(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Body() dto: BindKbsDto,
  ) {
    await this.service.bindAgent(agentId, dto.kbIds || []);
    return this.service.getAgentKbIds(agentId);
  }
}
