import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KgWarningService } from './kg-warning.service';
import { LlmModelEntity } from '../../database/entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsNumber, IsString, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class ExtractDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  taskIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(720)
  hours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(200)
  maxNodes?: number;
}

class SearchDto {
  @IsString()
  query: string;
}

class FromTextDto {
  @IsString()
  text: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(200)
  maxNodes?: number;
}

@Controller('knowledge-graph')
@UseGuards(JwtAuthGuard)
export class KnowledgeGraphController {
  constructor(
    private readonly kgService: KnowledgeGraphService,
    private readonly kgWarningService: KgWarningService,
    @InjectRepository(LlmModelEntity)
    private llmModelRepo: Repository<LlmModelEntity>,
  ) {}

  @Get('warnings')
  @HttpCode(HttpStatus.OK)
  async warnings(@CurrentUser() user: CurrentUserPayload) {
    const signals = await this.kgWarningService.checkRiskSignals(user.id);
    return { success: true, data: signals };
  }

  @Get('active-model')
  async activeModel() {
    const primary = await this.llmModelRepo.findOne({ where: { isKgPrimary: 1 } as any });
    const fallback = await this.llmModelRepo.find({ where: { isKgFallback: 1 } as any, order: { id: 'ASC' } });
    return {
      primary: primary ? { id: primary.id, name: primary.displayName || primary.model, provider: primary.provider } : null,
      fallback: fallback.map(m => ({ id: m.id, name: m.displayName || m.model, provider: m.provider })),
    };
  }

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  async extract(@CurrentUser() user: CurrentUserPayload, @Body() dto: ExtractDto) {
    const result = await this.kgService.extractGraph(user.id, {
      taskIds: dto.taskIds,
      hours: dto.hours,
      maxNodes: dto.maxNodes,
    });
    return { success: true, data: result };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async stats(@CurrentUser() user: CurrentUserPayload) {
    const result = await this.kgService.getGraphStats(user.id);
    return { success: true, data: result };
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@CurrentUser() user: CurrentUserPayload, @Body() dto: SearchDto) {
    const result = await this.kgService.searchGraph(user.id, dto.query);
    return { success: true, data: result };
  }

  @Post('from-text')
  @HttpCode(HttpStatus.OK)
  async fromText(@CurrentUser() _user: CurrentUserPayload, @Body() dto: FromTextDto) {
    const result = await this.kgService.extractFromText(dto.text, dto.maxNodes);
    return { success: true, data: result };
  }
}
