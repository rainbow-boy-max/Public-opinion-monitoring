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
import { ReportTemplateService } from './report-template.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { TemplateType } from '../../database/entities';

class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(256)
  description: string;

  @IsString()
  prompt: string;

  @IsIn(['daily', 'weekly', 'event', 'competitor', 'custom'])
  templateType: TemplateType;

  @IsOptional()
  @IsString()
  structure?: string;

  @IsOptional()
  @IsString()
  icon?: string;
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
  prompt?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'event', 'competitor', 'custom'])
  templateType?: TemplateType;

  @IsOptional()
  @IsString()
  structure?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsNumber()
  isActive?: number;
}

class GenerateReportDto {
  @IsNumber()
  templateId: number;

  @IsOptional()
  @IsArray()
  taskIds?: number[];

  @IsOptional()
  @IsString()
  timeRange?: string;

  @IsOptional()
  @IsString()
  customData?: string;
}

@Controller('report-templates')
@UseGuards(JwtAuthGuard)
export class ReportTemplateController {
  constructor(private service: ReportTemplateService) {}

  @Get()
  async list(@CurrentUser('id') userId: number, @Query('type') type?: string) {
    return this.service.list(userId, type);
  }

  @Get('presets')
  async presets() {
    return this.service.getPresetTemplates();
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @CurrentUser('id') userId: number,
    @Body() dto: GenerateReportDto,
  ) {
    return this.service.generateFromTemplate(userId, dto.templateId, {
      taskIds: dto.taskIds,
      timeRange: dto.timeRange,
      customData: dto.customData,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTemplateDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.service.delete(id);
  }
}
