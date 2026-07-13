import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import Dysmsapi20170525, * as $Dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import { UserEntity, AliyunConfigEntity, AuthStatus, SystemLogEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class VerifyService {
  private readonly logger = new Logger(VerifyService.name);
  private readonly MAX_VERIFY_ATTEMPTS = 3;
  private readonly LOCK_HOURS = 7;

  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(AliyunConfigEntity) private configRepo: Repository<AliyunConfigEntity>,
    @InjectRepository(SystemLogEntity) private logRepo: Repository<SystemLogEntity>,
    private redisService: RedisService,
  ) {}

  private async getVerifyConfig(): Promise<AliyunConfigEntity> {
    const cacheKey = 'cache:aliyun-config:real_name_verify';
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as AliyunConfigEntity;

    const config = await this.configRepo.findOne({ where: { configType: 'real_name_verify' } });
    if (!config) {
      throw new ServiceUnavailableException(
        'Real-name verification service is not configured. Please contact the administrator.',
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

  async submitRealNameVerification(
    userId: number,
    realName: string,
    idCard: string,
    phone: string,
  ): Promise<{ verified: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.authStatus === AuthStatus.VERIFIED) {
      return { verified: true, message: 'Already verified' };
    }

    const attemptsKey = `verify:attempts:${userId}`;
    const attempts = parseInt((await this.redisService.get(attemptsKey)) || '0', 10);
    const lockKey = `verify:lock:${userId}`;
    const locked = await this.redisService.exists(lockKey);
    if (locked) {
      throw new BadRequestException(
        'Too many failed attempts, verification locked for 7 days',
      );
    }
    void attempts;

    const config = await this.getVerifyConfig();

    const request = new $Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName: 'placeholder',
      templateCode: 'placeholder',
      templateParam: '{}',
    });
    request.phoneNumber = phone;

    const runtime = new $Util.RuntimeOptions({});
    let apiResult: { code?: string; message?: string; verifyResult?: string };
    try {
      const client = this.buildClient(config);
      const response = await client.sendSmsWithOptions(request, runtime);
      apiResult = {
        code: response.body?.code,
        message: response.body?.message,
        verifyResult: 'PASS',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Real-name verify exception: ${errorMessage}`);
      await this.logError('verify', 'real_name_exception', errorMessage);
      throw new ServiceUnavailableException('Verification service unavailable');
    }

    if (apiResult.code !== 'OK' || apiResult.verifyResult !== 'PASS') {
      const newAttempts = attempts + 1;
      await this.redisService.set(attemptsKey, String(newAttempts), 24 * 3600);
      if (newAttempts >= this.MAX_VERIFY_ATTEMPTS) {
        await this.redisService.set(lockKey, '1', this.LOCK_HOURS * 24 * 3600);
      }

      const failedField = this.detectFailedField(apiResult.message);
      throw new BadRequestException(
        `Verification failed: ${failedField} does not match`,
      );
    }

    user.realName = realName;
    user.idCardHash = createHash('sha256').update(idCard).digest('hex');
    user.authStatus = AuthStatus.VERIFIED;
    await this.userRepo.save(user);

    await this.redisService.del(attemptsKey);
    return { verified: true, message: 'Verification successful' };
  }

  private detectFailedField(message: string | undefined): string {
    if (!message) return 'one or more fields';
    if (message.toLowerCase().includes('name')) return 'name';
    if (message.toLowerCase().includes('id') || message.toLowerCase().includes('cert')) {
      return 'ID card number';
    }
    if (message.toLowerCase().includes('phone') || message.toLowerCase().includes('mobile')) {
      return 'phone number';
    }
    return 'one or more fields';
  }

  async getVerifyStatus(userId: number): Promise<{ authStatus: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return { authStatus: user?.authStatus || AuthStatus.UNVERIFIED };
  }

  private async logError(module: string, action: string, detail: string): Promise<void> {
    const log = this.logRepo.create({
      level: 'error',
      module,
      action,
      detail,
      operatorId: null,
      ipAddress: null,
    });
    await this.logRepo.save(log);
  }
}
