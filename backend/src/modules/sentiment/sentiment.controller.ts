import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { SentimentAnalysisService, type SentimentAnalysisConfig } from './sentiment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsString, IsOptional, IsArray, IsNumber, Min, IsBoolean, IsEnum } from 'class-validator';

class AnalyzeDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  aspect?: string;

  @IsOptional()
  detailed?: boolean;
}

class AnalyzeBatchDto {
  @IsArray()
  events: Array<{
    id: number;
    title: string;
    content: string;
  }>;
}

class ReanalyzeTaskDto {
  @IsNumber()
  @Min(1)
  taskId: number;
}

class UpdateConfigDto {
  @IsOptional()
  @IsString()
  method?: 'rule' | 'llm' | 'dual';

  @IsOptional()
  @IsNumber()
  modelId?: number;

  @IsOptional()
  @IsNumber()
  dualThreshold?: number;

  @IsOptional()
  @IsBoolean()
  sarcasmDetection?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  contextWindowSize?: number;
}

@Controller('sentiment')
@UseGuards(JwtAuthGuard)
export class SentimentController {
  constructor(private sentimentService: SentimentAnalysisService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() dto: AnalyzeDto) {
    const result = await this.sentimentService.analyze(dto.text, {
      aspect: dto.aspect,
      detailed: dto.detailed,
    });
    return { success: true, data: result };
  }

  @Post('analyze-batch')
  @HttpCode(HttpStatus.OK)
  async analyzeBatch(@Body() dto: AnalyzeBatchDto) {
    const results = await this.sentimentService.analyzeBatch(dto.events);
    return { success: true, data: results };
  }

  @Post('reanalyze/:eventId')
  @HttpCode(HttpStatus.OK)
  async reanalyzeEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    const result = await this.sentimentService.reanalyzeEvent(eventId);
    return { success: true, data: result };
  }

  @Post('reanalyze-task')
  @HttpCode(HttpStatus.OK)
  async reanalyzeTask(@Body() dto: ReanalyzeTaskDto) {
    const result = await this.sentimentService.reanalyzeTaskEvents(dto.taskId);
    return { success: true, data: result };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    const stats = await this.sentimentService.getStats();
    return { success: true, data: stats };
  }

  @Get('config')
  @HttpCode(HttpStatus.OK)
  async getConfig() {
    const config = this.sentimentService.getConfig();
    return { success: true, data: config };
  }

  @Post('config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() dto: UpdateConfigDto) {
    this.sentimentService.updateConfig(dto);
    return { success: true, data: this.sentimentService.getConfig() };
  }
}
