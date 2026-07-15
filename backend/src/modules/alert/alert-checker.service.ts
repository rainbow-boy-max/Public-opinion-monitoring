import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import {
  AlertRuleEntity,
  AlertRuleStatus,
  AlertConditionType,
  AlertChannel,
  OpinionEventEntity,
  AlertLogEntity,
} from '../../database/entities';
import { AlertRuleService } from './alert-rule.service';
import { WebhookPusherService } from '../webhooks/webhook-pusher.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class AlertCheckerService {
  private readonly logger = new Logger(AlertCheckerService.name);

  constructor(
    @InjectRepository(AlertLogEntity) private logRepo: Repository<AlertLogEntity>,
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
    private alertRuleService: AlertRuleService,
    private webhookPusherService: WebhookPusherService,
    private webhooksService: WebhooksService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAllRules(): Promise<void> {
    this.logger.debug('Running alert rule checker...');
    const rules = await this.alertRuleService.getAllActive();
    for (const rule of rules) {
      try {
        await this.checkRule(rule);
      } catch (err) {
        this.logger.error(`Alert check failed for rule ${rule.id}: ${(err as Error).message}`);
      }
    }
  }

  async checkRule(rule: AlertRuleEntity): Promise<void> {
    if (this.isInCooldown(rule)) return;

    let triggered = false;
    let triggerData: Record<string, unknown> = {};

    switch (rule.conditionType) {
      case AlertConditionType.SENTIMENT_NEGATIVE:
        triggered = await this.checkSentimentNegative(rule, triggerData);
        break;
      case AlertConditionType.VOLUME_SPIKE:
        triggered = await this.checkVolumeSpike(rule, triggerData);
        break;
      case AlertConditionType.KEYWORD_MATCH:
        triggered = await this.checkKeywordMatch(rule, triggerData);
        break;
      case AlertConditionType.PLATFORM_SPECIFIC:
        triggered = await this.checkPlatformSpecific(rule, triggerData);
        break;
    }

    if (triggered) {
      await this.fireAlert(rule, triggerData);
    }
  }

  private isInCooldown(rule: AlertRuleEntity): boolean {
    if (!rule.lastTriggeredAt) return false;
    const elapsed = (Date.now() - rule.lastTriggeredAt.getTime()) / 60000;
    return elapsed < rule.cooldownMinutes;
  }

  private async checkSentimentNegative(
    rule: AlertRuleEntity,
    triggerData: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.parseConfig(rule.conditionConfig);
    const timeWindow = config.timeWindow as number || 15;
    const threshold = config.threshold as number || 50;
    const since = new Date(Date.now() - timeWindow * 60000);

    const total = await this.eventRepo.count({
      where: { matchedAt: MoreThanOrEqual(since) },
    });
    if (total === 0) return false;

    const negative = await this.eventRepo.count({
      where: { matchedAt: MoreThanOrEqual(since), sentiment: 'negative' },
    });
    const percentage = (negative / total) * 100;
    triggerData.total = total;
    triggerData.negative = negative;
    triggerData.percentage = percentage;
    triggerData.threshold = threshold;

    return percentage >= threshold;
  }

  private async checkVolumeSpike(
    rule: AlertRuleEntity,
    triggerData: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.parseConfig(rule.conditionConfig);
    const timeWindow = config.timeWindow as number || 15;
    const threshold = config.threshold as number || 100;
    const since = new Date(Date.now() - timeWindow * 60000);

    const count = await this.eventRepo.count({
      where: { matchedAt: MoreThanOrEqual(since) },
    });
    triggerData.count = count;
    triggerData.threshold = threshold;
    triggerData.timeWindow = timeWindow;

    return count >= threshold;
  }

  private async checkKeywordMatch(
    rule: AlertRuleEntity,
    triggerData: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.parseConfig(rule.conditionConfig);
    const keywords = config.keywords as string[] || [];
    const since = new Date(Date.now() - 60 * 60000);

    const events = await this.eventRepo.find({
      where: { matchedAt: MoreThanOrEqual(since) },
      take: 100,
    });

    const matched: Array<{ id: number; title: string; keyword: string }> = [];
    for (const event of events) {
      for (const kw of keywords) {
        if (
          event.title.toLowerCase().includes(kw.toLowerCase()) ||
          event.content.toLowerCase().includes(kw.toLowerCase())
        ) {
          matched.push({ id: event.id, title: event.title, keyword: kw });
          break;
        }
      }
    }

    triggerData.matched = matched;
    triggerData.keywords = keywords;
    return matched.length > 0;
  }

  private async checkPlatformSpecific(
    rule: AlertRuleEntity,
    triggerData: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.parseConfig(rule.conditionConfig);
    const platforms = config.platforms as string[] || [];
    const since = new Date(Date.now() - 60 * 60000);

    const count = await this.eventRepo.count({
      where: { matchedAt: MoreThanOrEqual(since) },
    });
    if (count === 0) return false;

    const platformEvents = await this.eventRepo.find({
      where: { matchedAt: MoreThanOrEqual(since) },
      take: 1000,
    });
    const matched = platformEvents.filter((e) => platforms.includes(e.platform));
    triggerData.matchedCount = matched.length;
    triggerData.platforms = platforms;
    triggerData.events = matched.slice(0, 20).map((e) => ({
      id: e.id,
      platform: e.platform,
      title: e.title,
    }));

    return matched.length > 0;
  }

  private async fireAlert(rule: AlertRuleEntity, triggerData: Record<string, unknown>): Promise<void> {
    const title = `预警触发: ${rule.name}`;
    const message = `规则 "${rule.name}" 触发预警 (${rule.conditionType})`;

    const log = await this.logRepo.save({
      ruleId: rule.id,
      userId: rule.userId,
      title,
      message,
      triggerData: JSON.stringify(triggerData),
      status: 'sent',
    });

    try {
      if (rule.channel === AlertChannel.WEBHOOK) {
        await this.pushToWebhook(rule, title, message, triggerData);
      } else if (rule.channel === AlertChannel.SMS) {
        await this.pushSms(rule, title, message);
      }

      await this.logRepo.update(log.id, { status: 'sent' });
    } catch (err) {
      this.logger.error(`Alert delivery failed for rule ${rule.id}: ${(err as Error).message}`);
      await this.logRepo.update(log.id, { status: 'failed' });
    }

    await this.alertRuleService.updateLastTriggered(rule.id);
    this.logger.log(`Alert fired: rule=${rule.id}, type=${rule.conditionType}`);
  }

  private async pushToWebhook(
    rule: AlertRuleEntity,
    title: string,
    message: string,
    triggerData: Record<string, unknown>,
  ): Promise<void> {
    const channelConfig = this.parseConfig(rule.channelConfig || '{}');
    const webhookId = channelConfig.webhookId as number;
    if (!webhookId) {
      this.logger.warn(`No webhookId configured for rule ${rule.id}`);
      return;
    }
    const webhook = await this.webhooksService.getByIdForTask(webhookId);
    if (!webhook) {
      this.logger.warn(`Webhook ${webhookId} not found for rule ${rule.id}`);
      return;
    }
    const payload = {
      alertType: 'rule_trigger',
      ruleId: rule.id,
      ruleName: rule.name,
      conditionType: rule.conditionType,
      title,
      message,
      triggerData,
      timestamp: new Date().toISOString(),
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        this.logger.warn(`Webhook push returned ${response.status} for rule ${rule.id}`);
      }
    } catch (err) {
      this.logger.error(`Webhook push failed for rule ${rule.id}: ${(err as Error).message}`);
    }
  }

  private async pushSms(rule: AlertRuleEntity, title: string, _message: string): Promise<void> {
    try {
      this.logger.log(`SMS alert for rule ${rule.id}: ${title}`);
    } catch (err) {
      this.logger.error(`SMS push failed for rule ${rule.id}: ${(err as Error).message}`);
    }
  }

  private parseConfig(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
