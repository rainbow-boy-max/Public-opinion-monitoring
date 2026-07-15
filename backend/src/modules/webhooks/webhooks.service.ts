import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  WebhookEntity,
  WebhookTaskBindingEntity,
  WebhookFormat,
  PeriodicFreq,
  WebhookStatus,
} from '../../database/entities';
import { PayloadTemplateService } from './payload-template.service';

export interface CreateWebhookDto {
  name: string;
  url: string;
  format: WebhookFormat;
  secretKey?: string;
  smsAlertEnabled?: boolean;
  pushOnMatch?: boolean;
  pushPeriodic?: boolean;
  periodicFreq?: PeriodicFreq;
  periodicTime?: string;
  customTemplate?: string;
}

export interface UpdateWebhookDto extends Partial<CreateWebhookDto> {}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookEntity) private webhookRepo: Repository<WebhookEntity>,
    @InjectRepository(WebhookTaskBindingEntity)
    private bindingRepo: Repository<WebhookTaskBindingEntity>,
    private payloadTemplateService: PayloadTemplateService,
  ) {}

  async create(userId: number, dto: CreateWebhookDto): Promise<WebhookEntity> {
    this.validateWebhook(dto.url, dto.format);
    const webhook = this.webhookRepo.create({
      userId,
      name: dto.name,
      url: dto.url,
      format: dto.format,
      secretKey: dto.secretKey || null,
      ingestToken: randomBytes(32).toString('hex'),
      smsAlertEnabled: dto.smsAlertEnabled ? 1 : 0,
      pushOnMatch: dto.pushOnMatch === false ? 0 : 1,
      pushPeriodic: dto.pushPeriodic ? 1 : 0,
      periodicFreq: dto.periodicFreq || null,
      periodicTime: dto.periodicTime || null,
      status: WebhookStatus.ACTIVE,
    });
    await this.webhookRepo.save(webhook);
    this.logger.log(`Webhook created: id=${webhook.id} userId=${userId}`);
    return webhook;
  }

  async list(userId: number): Promise<WebhookEntity[]> {
    return this.webhookRepo.find({ where: { userId }, order: { id: 'DESC' } });
  }

  async getById(userId: number, id: number): Promise<WebhookEntity> {
    const webhook = await this.webhookRepo.findOne({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.userId !== userId) throw new ForbiddenException('Access denied');
    return webhook;
  }

  async getByIdForTask(id: number): Promise<WebhookEntity | null> {
    return this.webhookRepo.findOne({ where: { id } });
  }

  async getByIngestToken(token: string): Promise<WebhookEntity> {
    const webhook = await this.webhookRepo.findOne({ where: { ingestToken: token } });
    if (!webhook) throw new NotFoundException('Invalid ingest token');
    return webhook;
  }

  async update(userId: number, id: number, dto: UpdateWebhookDto): Promise<WebhookEntity> {
    const webhook = await this.getById(userId, id);
    const url = dto.url ?? webhook.url;
    const format = dto.format ?? webhook.format;
    this.validateWebhook(url, format);
    if (dto.name !== undefined) webhook.name = dto.name;
    if (dto.url !== undefined) webhook.url = dto.url;
    if (dto.format !== undefined) webhook.format = dto.format;
    if (dto.secretKey !== undefined) webhook.secretKey = dto.secretKey;
    if (dto.smsAlertEnabled !== undefined) webhook.smsAlertEnabled = dto.smsAlertEnabled ? 1 : 0;
    if (dto.pushOnMatch !== undefined) webhook.pushOnMatch = dto.pushOnMatch ? 1 : 0;
    if (dto.pushPeriodic !== undefined) webhook.pushPeriodic = dto.pushPeriodic ? 1 : 0;
    if (dto.periodicFreq !== undefined) webhook.periodicFreq = dto.periodicFreq;
    if (dto.periodicTime !== undefined) webhook.periodicTime = dto.periodicTime;
    await this.webhookRepo.save(webhook);
    return webhook;
  }

  async delete(userId: number, id: number): Promise<void> {
    const webhook = await this.getById(userId, id);
    await this.webhookRepo.remove(webhook);
    await this.bindingRepo.delete({ webhookId: id });
  }

  async testWebhook(userId: number, id: number): Promise<{ message: string }> {
    const webhook = await this.getById(userId, id);
    const testEvent = {
      platform: 'test',
      title: '测试舆情告警',
      content: '这是一条来自舆情监测系统的测试消息，用于验证 Webhook 连通性。',
      summary: '测试消息',
      author: '测试机器人',
      publishTime: new Date(),
      url: 'https://example.com',
      readCount: 0,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      sentiment: 'neutral' as const,
      keywords: ['测试'],
    };

    const payload = this.payloadTemplateService.render(webhook, testEvent);
    try {
      await this.payloadTemplateService.sendPayload(webhook.url, payload, webhook.secretKey);
      return { message: 'Webhook connection successful' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Webhook test failed: ${msg}`);
    }
  }

  async bindTasks(userId: number, webhookId: number, taskIds: number[]): Promise<void> {
    const webhook = await this.getById(userId, webhookId);
    await this.bindingRepo.delete({ webhookId: webhook.id });
    const bindings = taskIds.map((taskId) =>
      this.bindingRepo.create({ webhookId: webhook.id, taskId, status: 'active' }),
    );
    await this.bindingRepo.save(bindings);
  }

  async getBoundTasks(webhookId: number): Promise<number[]> {
    const bindings = await this.bindingRepo.find({
      where: { webhookId, status: 'active' },
    });
    return bindings.map((b) => b.taskId);
  }

  async setStatus(id: number, status: WebhookStatus): Promise<void> {
    await this.webhookRepo.update(id, { status, lastPushAt: new Date() });
  }

  async updateLastPush(id: number): Promise<void> {
    await this.webhookRepo.update(id, { lastPushAt: new Date() });
  }

  private validateUrl(url: string, format: WebhookFormat): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid webhook URL format');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use http or https protocol');
    }
    const domainPatterns: Record<WebhookFormat, RegExp | null> = {
      [WebhookFormat.WECOM]: /qyapi\.weixin\.qq\.com/i,
      [WebhookFormat.DINGTALK]: /oapi\.dingtalk\.com/i,
      [WebhookFormat.FEISHU]: /open\.feishu\.cn/i,
      [WebhookFormat.CUSTOM_JSON]: null,
    };
    const pattern = domainPatterns[format];
    if (pattern && !pattern.test(parsed.hostname)) {
      this.logger.warn(
        `Webhook URL hostname "${parsed.hostname}" does not match expected pattern for format ${format}`,
      );
    }
  }

  private validateWebhook(url: string, format: WebhookFormat): void {
    this.validateUrl(url, format);
  }
}
