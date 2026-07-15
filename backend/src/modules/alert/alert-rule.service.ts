import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AlertRuleEntity,
  AlertConditionType,
  AlertChannel,
  AlertRuleStatus,
} from '../../database/entities';

export interface CreateAlertRuleDto {
  name: string;
  description?: string;
  conditionType: AlertConditionType;
  conditionConfig: Record<string, unknown>;
  channel: AlertChannel;
  channelConfig?: Record<string, unknown>;
  cooldownMinutes?: number;
}

export interface UpdateAlertRuleDto {
  name?: string;
  description?: string;
  conditionType?: AlertConditionType;
  conditionConfig?: Record<string, unknown>;
  channel?: AlertChannel;
  channelConfig?: Record<string, unknown>;
  cooldownMinutes?: number;
}

@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(
    @InjectRepository(AlertRuleEntity) private ruleRepo: Repository<AlertRuleEntity>,
  ) {}

  async create(userId: number, dto: CreateAlertRuleDto): Promise<AlertRuleEntity> {
    this.validateConditionConfig(dto.conditionType, dto.conditionConfig);
    const rule = this.ruleRepo.create({
      userId,
      name: dto.name,
      description: dto.description || null,
      conditionType: dto.conditionType,
      conditionConfig: JSON.stringify(dto.conditionConfig),
      channel: dto.channel,
      channelConfig: dto.channelConfig ? JSON.stringify(dto.channelConfig) : null,
      cooldownMinutes: dto.cooldownMinutes ?? 60,
      status: AlertRuleStatus.ACTIVE,
    });
    await this.ruleRepo.save(rule);
    this.logger.log(`Alert rule created: id=${rule.id} userId=${userId}`);
    return rule;
  }

  async list(userId: number): Promise<AlertRuleEntity[]> {
    return this.ruleRepo.find({ where: { userId }, order: { id: 'DESC' } });
  }

  async getAllActive(): Promise<AlertRuleEntity[]> {
    return this.ruleRepo.find({ where: { status: AlertRuleStatus.ACTIVE } });
  }

  async getById(userId: number, id: number): Promise<AlertRuleEntity> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Alert rule not found');
    if (rule.userId !== userId) throw new ForbiddenException('Access denied');
    return rule;
  }

  async getByIdRaw(id: number): Promise<AlertRuleEntity | null> {
    return this.ruleRepo.findOne({ where: { id } });
  }

  async update(userId: number, id: number, dto: UpdateAlertRuleDto): Promise<AlertRuleEntity> {
    const rule = await this.getById(userId, id);
    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.description !== undefined) rule.description = dto.description;
    if (dto.conditionType !== undefined) rule.conditionType = dto.conditionType;
    if (dto.conditionConfig !== undefined) {
      const ct = dto.conditionType ?? rule.conditionType;
      this.validateConditionConfig(ct, dto.conditionConfig);
      rule.conditionConfig = JSON.stringify(dto.conditionConfig);
    }
    if (dto.channel !== undefined) rule.channel = dto.channel;
    if (dto.channelConfig !== undefined) {
      rule.channelConfig = JSON.stringify(dto.channelConfig);
    }
    if (dto.cooldownMinutes !== undefined) rule.cooldownMinutes = dto.cooldownMinutes;
    await this.ruleRepo.save(rule);
    return rule;
  }

  async delete(userId: number, id: number): Promise<void> {
    const rule = await this.getById(userId, id);
    await this.ruleRepo.remove(rule);
  }

  async toggleStatus(userId: number, id: number): Promise<AlertRuleEntity> {
    const rule = await this.getById(userId, id);
    rule.status = rule.status === AlertRuleStatus.ACTIVE ? AlertRuleStatus.PAUSED : AlertRuleStatus.ACTIVE;
    await this.ruleRepo.save(rule);
    return rule;
  }

  async updateLastTriggered(id: number): Promise<void> {
    await this.ruleRepo.update(id, { lastTriggeredAt: new Date() });
  }

  private validateConditionConfig(type: AlertConditionType, config: Record<string, unknown>): void {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('conditionConfig must be a valid JSON object');
    }
    switch (type) {
      case AlertConditionType.SENTIMENT_NEGATIVE:
        if (typeof config.threshold !== 'number') {
          throw new BadRequestException('sentiment_negative requires threshold (number)');
        }
        if (typeof config.timeWindow !== 'number') {
          throw new BadRequestException('sentiment_negative requires timeWindow (number)');
        }
        break;
      case AlertConditionType.VOLUME_SPIKE:
        if (typeof config.threshold !== 'number') {
          throw new BadRequestException('volume_spike requires threshold (number)');
        }
        if (typeof config.timeWindow !== 'number') {
          throw new BadRequestException('volume_spike requires timeWindow (number)');
        }
        break;
      case AlertConditionType.KEYWORD_MATCH:
        if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
          throw new BadRequestException('keyword_match requires keywords (string[])');
        }
        break;
      case AlertConditionType.PLATFORM_SPECIFIC:
        if (!Array.isArray(config.platforms) || config.platforms.length === 0) {
          throw new BadRequestException('platform_specific requires platforms (string[])');
        }
        break;
    }
  }
}
