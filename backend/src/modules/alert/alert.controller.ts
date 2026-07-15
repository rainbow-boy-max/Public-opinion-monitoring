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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AlertRuleService, CreateAlertRuleDto, UpdateAlertRuleDto } from './alert-rule.service';
import { AlertCheckerService } from './alert-checker.service';
import { AlertLogEntity, AlertRuleEntity } from '../../database/entities';
import { IsString, IsOptional, IsEnum, IsNumber, IsObject, Min } from 'class-validator';
import {
  AlertConditionType,
  AlertChannel,
} from '../../database/entities';

class CreateRuleDto implements CreateAlertRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(AlertConditionType)
  conditionType: AlertConditionType;

  @IsObject()
  conditionConfig: Record<string, unknown>;

  @IsEnum(AlertChannel)
  channel: AlertChannel;

  @IsOptional()
  @IsObject()
  channelConfig?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cooldownMinutes?: number;
}

class UpdateRuleDto implements UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AlertConditionType)
  conditionType?: AlertConditionType;

  @IsOptional()
  @IsObject()
  conditionConfig?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(AlertChannel)
  channel?: AlertChannel;

  @IsOptional()
  @IsObject()
  channelConfig?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cooldownMinutes?: number;
}

@Controller('alert')
@UseGuards(JwtAuthGuard)
export class AlertController {
  constructor(
    private alertRuleService: AlertRuleService,
    private alertCheckerService: AlertCheckerService,
    @InjectRepository(AlertLogEntity) private logRepo: Repository<AlertLogEntity>,
  ) {}

  @Get('platforms')
  async listPlatforms() {
    return [
      { value: 'weibo', label: '微博' },
      { value: 'weixin', label: '微信' },
      { value: 'douyin', label: '抖音' },
      { value: 'xiaohongshu', label: '小红书' },
      { value: 'kuaishou', label: '快手' },
      { value: 'baijiahao', label: '百家号' },
    ];
  }

  @Get('rules')
  async listRules(@CurrentUser('id') userId: number) {
    const rules = await this.alertRuleService.list(userId);
    return rules.map(r => this.serializeRule(r));
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  async createRule(@CurrentUser('id') userId: number, @Body() dto: CreateRuleDto) {
    const rule = await this.alertRuleService.create(userId, dto);
    return this.serializeRule(rule);
  }

  @Put('rules/:id')
  @HttpCode(HttpStatus.OK)
  async updateRule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRuleDto,
  ) {
    const rule = await this.alertRuleService.update(userId, id, dto);
    return this.serializeRule(rule);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.alertRuleService.delete(userId, id);
  }

  @Post('rules/:id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleRule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.alertRuleService.toggleStatus(userId, id);
  }

  @Get('logs')
  async listLogs(
    @CurrentUser('id') userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit || '20', 10) || 20, 100);
    const skip = (Math.max(parseInt(page || '1', 10) || 1, 1) - 1) * take;
    const [items, total] = await this.logRepo.findAndCount({
      where: { userId },
      order: { id: 'DESC' },
      take,
      skip,
    });
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  @Post('check-now/:id')
  @HttpCode(HttpStatus.OK)
  async checkNow(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const rule = await this.alertRuleService.getById(userId, id);
    await this.alertCheckerService.checkRule(rule);
    return { message: 'Check completed' };
  }

  private serializeRule(rule: AlertRuleEntity) {
    return {
      id: rule.id,
      userId: rule.userId,
      name: rule.name,
      description: rule.description,
      conditionType: rule.conditionType,
      conditionConfig: JSON.parse(rule.conditionConfig),
      channel: rule.channel,
      channelConfig: rule.channelConfig ? JSON.parse(rule.channelConfig) : null,
      status: rule.status,
      cooldownMinutes: rule.cooldownMinutes,
      lastTriggeredAt: rule.lastTriggeredAt,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
