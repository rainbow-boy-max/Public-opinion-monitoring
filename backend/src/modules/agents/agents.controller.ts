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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsNumber, IsArray, IsEnum, IsInt, Min, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';

class CapabilitiesDto {
  @IsOptional()
  @IsBoolean()
  vision?: boolean;

  @IsOptional()
  @IsBoolean()
  reasoning?: boolean;

  @IsOptional()
  @IsBoolean()
  webSearch?: boolean;
}

class CreateAgentDto {
  @IsString()
  name: string;

  @IsString()
  roleDescription: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsNumber()
  primaryModelId: number;

  @IsOptional()
  @IsArray()
  fallbackModelIds?: number[];

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  kbEnabled?: number;

  @IsOptional()
  @IsNumber()
  kbTopK?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  knowledgeBaseIds?: number[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CapabilitiesDto)
  capabilities?: CapabilitiesDto;
}

class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  roleDescription?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  primaryModelId?: number;

  @IsOptional()
  @IsArray()
  fallbackModelIds?: number[];

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  kbEnabled?: number;

  @IsOptional()
  @IsNumber()
  kbTopK?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  knowledgeBaseIds?: number[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CapabilitiesDto)
  capabilities?: CapabilitiesDto;
}

class ChatDto {
  @IsString()
  message: string;

  @IsOptional()
  stream?: boolean;
}

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private service: AgentsService) {}

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
  ) {
    return this.service.list({ page, pageSize, status });
  }

  @Get('available')
  async listAvailable() {
    return this.service.listAvailable();
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAgentDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAgentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }

  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    const wantStream = dto.stream === true || (res.req.headers.accept || '').includes('text/event-stream');
    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const stream = await this.service.chat(id, dto.message, true);
        for await (const ev of stream as any) {
          if (ev.chunk) {
            res.write(`event: chunk\ndata: ${JSON.stringify({ content: ev.chunk })}\n\n`);
          }
          if (ev.finalResult) {
            res.write(`event: done\ndata: ${JSON.stringify(ev.finalResult)}\n\n`);
          }
        }
      } catch (err) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
        );
      }
      res.end();
      return;
    }

    const result = await this.service.chat(id, dto.message, false);
    return result;
  }
}
