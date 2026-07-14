import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LlmModelsService } from './llm-models.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

class SaveModelDto {
  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsString()
  displayName: string;

  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiVersion?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPreset?: boolean;

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

class TestModelDto {
  @IsOptional()
  @IsString()
  prompt?: string;
}

class FetchModelsDto {
  @IsString()
  baseUrl: string;

  @IsString()
  apiKey: string;
}

@Controller('admin/llm-models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class LlmModelsController {
  constructor(private service: LlmModelsService) {}

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('provider') provider?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list({
      page: Number(page),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
      provider,
      search,
    });
  }

  @Get('presets')
  async listPresets() {
    return this.service.listPresets();
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async save(@Body() dto: SaveModelDto) {
    return this.service.save(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveModelDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async test(@Param('id', ParseIntPipe) id: number, @Body() dto: TestModelDto) {
    return this.service.testConnection(id, dto.prompt);
  }

  @Post('fetch-models')
  @HttpCode(HttpStatus.OK)
  async fetchModels(@Body() dto: FetchModelsDto) {
    return this.service.fetchModels(dto.baseUrl, dto.apiKey);
  }
}
