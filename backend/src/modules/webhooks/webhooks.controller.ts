import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookPushLogEntity, WebhookFormat, PeriodicFreq } from '../../database/entities';
import { IsString, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';

class CreateWebhookDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsEnum(WebhookFormat)
  format: WebhookFormat;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  smsAlertEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushOnMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  pushPeriodic?: boolean;

  @IsOptional()
  @IsEnum(PeriodicFreq)
  periodicFreq?: PeriodicFreq;

  @IsOptional()
  @IsString()
  periodicTime?: string;

  @IsOptional()
  @IsArray()
  taskIds?: number[];
}

class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(WebhookFormat)
  format?: WebhookFormat;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  smsAlertEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushOnMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  pushPeriodic?: boolean;

  @IsOptional()
  @IsEnum(PeriodicFreq)
  periodicFreq?: PeriodicFreq;

  @IsOptional()
  @IsString()
  periodicTime?: string;
}

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(
    private webhooksService: WebhooksService,
    @InjectRepository(WebhookPushLogEntity) private logRepo: Repository<WebhookPushLogEntity>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateWebhookDto) {
    const webhook = await this.webhooksService.create(userId, dto);
    if (dto.taskIds && dto.taskIds.length > 0) {
      await this.webhooksService.bindTasks(userId, webhook.id, dto.taskIds);
    }
    return webhook;
  }

  @Get()
  async list(@CurrentUser('id') userId: number) {
    return this.webhooksService.list(userId);
  }

  @Get(':id')
  async get(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.webhooksService.getById(userId, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.webhooksService.delete(userId, id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.webhooksService.testWebhook(userId, id);
  }

  @Get(':id/logs')
  async getLogs(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.webhooksService.getById(userId, id);
    return this.logRepo.find({
      where: { webhookId: id },
      order: { id: 'DESC' },
      take: 50,
    });
  }
}
