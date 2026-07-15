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
import { AlertLogEntity } from '../../database/entities';
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

  @Get('rules')
  async listRules(@CurrentUser('id') userId: number) {
    return this.alertRuleService.list(userId);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  async createRule(@CurrentUser('id') userId: number, @Body() dto: CreateRuleDto) {
    return this.alertRuleService.create(userId, dto);
  }

  @Put('rules/:id')
  @HttpCode(HttpStatus.OK)
  async updateRule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.alertRuleService.update(userId, id, dto);
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
}
