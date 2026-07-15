import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { AgentTemplateService } from './agent-template.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  systemPrompt: string;

  @IsString()
  capabilities: string;

  @IsOptional()
  @IsString()
  suggestedModel?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsString()
  @IsIn(['pr', 'service', 'writing', 'analysis', 'other'])
  category: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  capabilities?: string;

  @IsOptional()
  @IsString()
  suggestedModel?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pr', 'service', 'writing', 'analysis', 'other'])
  category?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

class DeployDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsInt()
  @Min(1)
  primaryModelId: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fallbackModelIds?: number[];
}

@Controller('agent-templates')
export class AgentTemplateController {
  constructor(private service: AgentTemplateService) {}

  @Get()
  async list(@Query('category') category?: string) {
    return this.service.listTemplates(category);
  }

  @Get('categories')
  async categories() {
    return this.service.listCategories();
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTemplate(id);
  }

  @Post(':id/deploy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deploy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeployDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createFromTemplate(user?.id || 0, id, {
      name: dto.name,
      primaryModelId: dto.primaryModelId,
      fallbackModelIds: dto.fallbackModelIds,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.updateTemplate(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.deleteTemplate(id);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async toggle(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleTemplate(id);
  }
}
