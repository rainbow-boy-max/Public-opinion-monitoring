import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Dysmsapi20170525, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import { Config as $Config } from '@alicloud/openapi-client';
import { SmsLogEntity, AliyunConfigEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { RedisService } from '../../redis/redis.service';

export type SmsScene = 'login' | 'register' | 'reset' | 'notify' | 'alert';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly DAILY_LIMIT = 1000;

  constructor(
    @InjectRepository(SmsLogEntity) private smsLogRepo: Repository<SmsLogEntity>,
    @InjectRepository(AliyunConfigEntity) private configRepo: Repository<AliyunConfigEntity>,
    private redisService: RedisService,
  ) {}

  private async getSmsConfig(): Promise<AliyunConfigEntity> {
    const cacheKey = 'cache:aliyun-config:sms';
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as AliyunConfigEntity;

    const config = await this.configRepo.findOne({ where: { configType: 'sms' } });
    if (!config) {
      throw new ServiceUnavailableException(
        'Aliyun SMS service is not configured. Please contact the administrator.',
      );
    }
    config.accessKey = CryptoUtil.decrypt(config.accessKey);
    config.secretKey = CryptoUtil.decrypt(config.secretKey);
    await this.redisService.set(cacheKey, JSON.stringify(config), 30);
    return config;
  }

  private buildClient(config: AliyunConfigEntity): Dysmsapi20170525 {
    const openApiConfig = new $OpenApi.Config({
      accessKeyId: config.accessKey,
      accessKeySecret: config.secretKey,
    });
    openApiConfig.endpoint = 'dysmsapi.aliyuncs.com';
    return new Dysmsapi20170525(openApiConfig);
  }

  async sendVerificationCode(phone: string, code: string, scene: SmsScene): Promise<void> {
    const config = await this.getSmsConfig();
    await this.checkDailyLimit(phone);

    const templateParam = JSON.stringify({ code });
    const request = new $Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode: config.templateCode,
      templateParam,
    });

    const runtime = new $Util.RuntimeOptions({});
    try {
      const client = this.buildClient(config);
      const response = await client.sendSmsWithOptions(request, runtime);
      const code2 = response.body?.code;
      const message = response.body?.message;

      if (code2 !== 'OK') {
        await this.logSms(phone, scene, config.templateCode, 'failed', code2, message);
        this.logger.error(`SMS send failed: ${code2} - ${message}`);
        throw new ServiceUnavailableException(`SMS send failed: ${message}`);
      }

      await this.logSms(phone, scene, config.templateCode, 'sent', null, null);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.logSms(phone, scene, config.templateCode, 'failed', 'EXCEPTION', errorMessage);
      this.logger.error(`SMS send exception: ${errorMessage}`);
      throw new ServiceUnavailableException('SMS service unavailable');
    }
  }

  async sendNotification(
    phone: string,
    templateCode: string,
    templateParam: Record<string, string>,
    scene: SmsScene = 'notify',
  ): Promise<void> {
    const config = await this.getSmsConfig();
    await this.checkDailyLimit(phone);

    const request = new $Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.signName,
      templateCode,
      templateParam: JSON.stringify(templateParam),
    });

    const runtime = new $Util.RuntimeOptions({});
    try {
      const client = this.buildClient(config);
      const response = await client.sendSmsWithOptions(request, runtime);
      const respCode = response.body?.code;
      const message = response.body?.message;

      if (respCode !== 'OK') {
        await this.logSms(phone, scene, templateCode, 'failed', respCode, message);
        throw new ServiceUnavailableException(`SMS send failed: ${message}`);
      }

      await this.logSms(phone, scene, templateCode, 'sent', null, null);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.logSms(phone, scene, templateCode, 'failed', 'EXCEPTION', errorMessage);
      throw new ServiceUnavailableException('SMS service unavailable');
    }
  }

  async sendTestSms(phone: string): Promise<{ message: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.sendVerificationCode(phone, code, 'login');
    return { message: 'Test SMS sent successfully' };
  }

  async checkDailyLimit(_phone: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await this.smsLogRepo.count({
      where: { createdAt: today as any },
    });
    if (count >= this.DAILY_LIMIT) {
      throw new ServiceUnavailableException('Daily SMS sending limit reached');
    }
  }

  private async logSms(
    phone: string,
    scene: SmsScene,
    templateCode: string,
    status: 'sent' | 'success' | 'failed',
    errorCode: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    const log = this.smsLogRepo.create({ phone, scene, templateCode, status, errorCode, errorMessage });
    await this.smsLogRepo.save(log);
  }
}
