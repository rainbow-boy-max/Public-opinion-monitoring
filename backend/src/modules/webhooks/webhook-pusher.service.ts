import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WebhookEntity,
  WebhookPushLogEntity,
  WebhookTaskBindingEntity,
  OpinionEventEntity,
  WebhookStatus,
} from '../../database/entities';
import { WebhooksService } from './webhooks.service';
import { PayloadTemplateService } from './payload-template.service';
import { RedisService } from '../../redis/redis.service';

const RETRY_DELAYS = [5000, 15000, 45000];
const MAX_RETRIES = 3;
const OPINION_CHANNEL = 'pubsub:opinion:new';

@Injectable()
export class WebhookPusherService implements OnModuleInit {
  private readonly logger = new Logger(WebhookPusherService.name);
  private subscriberRegistered = false;

  constructor(
    @InjectRepository(WebhookPushLogEntity)
    private logRepo: Repository<WebhookPushLogEntity>,
    @InjectRepository(WebhookTaskBindingEntity)
    private bindingRepo: Repository<WebhookTaskBindingEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private webhooksService: WebhooksService,
    private payloadTemplateService: PayloadTemplateService,
    private redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.subscriberRegistered) return;
    this.subscriberRegistered = true;
    try {
      await this.redisService.subscribe(OPINION_CHANNEL, (message: string) => {
        this.handleOpinionMessage(message).catch((err) =>
          this.logger.error('Handle opinion message failed', err as Error),
        );
      });
      this.logger.log(`WebhookPusher subscribed to ${OPINION_CHANNEL}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to ${OPINION_CHANNEL}`, err as Error);
    }
  }

  private async handleOpinionMessage(message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message) as {
        userId: number;
        taskId: number;
        eventId: number;
      };
      if (!parsed.taskId || !parsed.eventId) return;
      await this.pushEventForTask(parsed.taskId, parsed.eventId);
    } catch (err) {
      this.logger.warn(`Bad opinion message: ${(err as Error).message}`);
    }
  }

  async pushEventForTask(taskId: number, eventId: number): Promise<void> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      this.logger.warn(`Event ${eventId} not found, skipping webhook push`);
      return;
    }

    const bindings = await this.bindingRepo.find({
      where: { taskId, status: 'active' },
    });
    if (bindings.length === 0) return;

    for (const binding of bindings) {
      const webhook = await this.webhooksService.getByIdForTask(binding.webhookId);
      if (!webhook || webhook.status === WebhookStatus.DISABLED) continue;
      if (webhook.pushOnMatch !== 1) continue;

      await this.pushToWebhook(webhook, event);
    }
  }

  async pushPeriodicReports(userId: number, webhook: WebhookEntity): Promise<void> {
    const since = new Date();
    if (webhook.periodicFreq === 'hourly') since.setHours(since.getHours() - 1);
    else if (webhook.periodicFreq === 'every_6h') since.setHours(since.getHours() - 6);
    else since.setHours(since.getHours() - 24);

    const taskIds = await this.webhooksService.getBoundTasks(webhook.id);
    if (taskIds.length === 0) return;

    const events = await this.eventRepo
      .createQueryBuilder('e')
      .where('e.task_id IN (:...taskIds)', { taskIds })
      .andWhere('e.matched_at >= :since', { since })
      .andWhere('e.status = 0')
      .orderBy('e.matched_at', 'DESC')
      .limit(100)
      .getMany();

    if (events.length === 0) return;

    const summary = {
      reportType: 'periodic',
      periodStart: since.toISOString(),
      periodEnd: new Date().toISOString(),
      totalEvents: events.length,
      events: events.map((e) => this.payloadTemplateService.toTemplateEvent(e)),
    };

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const text = await response.text();

      await this.logRepo.save({
        webhookId: webhook.id,
        eventId: null,
        httpStatus: response.status,
        responseBody: text,
        retryCount: 0,
        result: response.ok ? 'success' : 'failed',
        durationMs: duration,
      });

      if (!response.ok) {
        await this.webhooksService.setStatus(webhook.id, WebhookStatus.ERROR);
      } else {
        await this.webhooksService.updateLastPush(webhook.id);
      }
    } catch (err) {
      clearTimeout(timer);
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Periodic push failed for webhook ${webhook.id}: ${errorMsg}`);
      await this.webhooksService.setStatus(webhook.id, WebhookStatus.ERROR);
    }
    void userId;
  }

  private async pushToWebhook(webhook: WebhookEntity, event: OpinionEventEntity): Promise<void> {
    const payload = this.payloadTemplateService.render(
      webhook,
      this.payloadTemplateService.toTemplateEvent(event),
    );

    let lastStatus = 0;
    let lastBody = '';
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const startTime = Date.now();
      try {
        const response = await this.payloadTemplateService.sendPayload(
          webhook.url,
          payload,
          webhook.secretKey,
        );
        const duration = Date.now() - startTime;
        lastStatus = response.status;
        lastBody = response.body;

        if (response.status >= 200 && response.status < 300) {
          await this.logRepo.save({
            webhookId: webhook.id,
            eventId: event.id,
            httpStatus: response.status,
            responseBody: response.body,
            retryCount: attempt,
            result: 'success',
            durationMs: duration,
          });
          await this.webhooksService.updateLastPush(webhook.id);
          if (webhook.status === WebhookStatus.ERROR) {
            await this.webhooksService.setStatus(webhook.id, WebhookStatus.ACTIVE);
          }
          return;
        }

        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAYS[attempt]);
          continue;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastBody = errorMsg;
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAYS[attempt]);
          continue;
        }
      }
    }

    await this.logRepo.save({
      webhookId: webhook.id,
      eventId: event.id,
      httpStatus: lastStatus,
      responseBody: lastBody,
      retryCount: MAX_RETRIES,
      result: lastStatus >= 400 && lastStatus !== 0 ? 'failed' : 'timeout',
      durationMs: 0,
    });
    await this.webhooksService.setStatus(webhook.id, WebhookStatus.ERROR);
    this.logger.warn(`Webhook push failed after retries: id=${webhook.id}, event=${event.id}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
