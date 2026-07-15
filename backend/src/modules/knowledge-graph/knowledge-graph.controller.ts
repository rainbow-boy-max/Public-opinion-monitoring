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
    @InjectRepository(LlmModelEntity)
    private llmModelRepo: Repository<LlmModelEntity>,
  ) {}

  @Get('active-model')
  async activeModel() {
    const models = await this.llmModelRepo.find({
      where: { isEnabled: 1 } as any,
      order: { sortOrder: 'ASC' as any },
      take: 1,
    });
    if (models.length === 0) {
      return { name: null, message: '未配置 LLM 模型' };
    }
    const m = models[0];
    return {
      name: m.displayName || m.model,
      model: m.model,
      provider: m.provider,
      apiStyle: m.apiStyle,
      isEnabled: true,
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
