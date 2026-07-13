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
import { SmsTemplatesService } from './sms-templates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { SmsTemplateScene, SmsTemplateStatus } from '../../database/entities';

class CreateTemplateDto {
  @IsEnum(SmsTemplateScene)
  scene: SmsTemplateScene;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  signName?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  setDefault?: boolean;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  signName?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsBoolean()
  setDefault?: boolean;

  @IsOptional()
  @IsEnum(SmsTemplateStatus)
  status?: SmsTemplateStatus;
}

@Controller('admin/sms-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SmsTemplatesController {
  constructor(private service: SmsTemplatesService) {}

  @Get()
  async list(@Query('scene') scene?: SmsTemplateScene) {
    const items = scene
      ? await this.service.listByScene(scene)
      : await this.service.listAll();
    return { items };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTemplateDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.delete(id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submit(@Param('id', ParseIntPipe) id: number) {
    return this.service.submitForReview(id);
  }

  @Post(':id/sync-status')
  @HttpCode(HttpStatus.OK)
  async syncStatus(@Param('id', ParseIntPipe) id: number) {
    return this.service.syncReviewStatus(id);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  async setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.service.setDefault(id);
  }

  @Post('init-defaults')
  @HttpCode(HttpStatus.OK)
  async initDefaults() {
    return this.service.initDefaults();
  }
}
