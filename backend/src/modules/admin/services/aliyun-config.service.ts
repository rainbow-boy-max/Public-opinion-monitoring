import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AliyunConfigEntity } from '../../../database/entities';
import { CryptoUtil } from '../../../utils/crypto.util';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class AliyunConfigService {
  private readonly logger = new Logger(AliyunConfigService.name);

  constructor(
    @InjectRepository(AliyunConfigEntity)
    private configRepo: Repository<AliyunConfigEntity>,
    private redisService: RedisService,
  ) {}

  async getSmsConfig(): Promise<Partial<AliyunConfigEntity>> {
    const config = await this.configRepo.findOne({ where: { configType: 'sms' } });
    if (!config) return null;
    return {
      id: config.id,
      configType: config.configType,
      signName: config.signName,
      templateCode: config.templateCode,
      accessKey: this.maskSensitive(config.accessKey),
      secretKey: this.maskSensitive(config.secretKey),
    };
  }

  async saveSmsConfig(dto: {
    accessKey: string;
    secretKey: string;
    signName: string;
    templateCode: string;
  }): Promise<void> {
    let config = await this.configRepo.findOne({ where: { configType: 'sms' } });
    if (!config) {
      config = this.configRepo.create({ configType: 'sms' });
    }
    config.accessKey = CryptoUtil.encrypt(dto.accessKey);
    config.secretKey = CryptoUtil.encrypt(dto.secretKey);
    config.signName = dto.signName;
    config.templateCode = dto.templateCode;
    await this.configRepo.save(config);
    await this.invalidateCache('sms');
    this.logger.log('Aliyun SMS config updated');
  }

  async getVerifyConfig(): Promise<Partial<AliyunConfigEntity>> {
    const config = await this.configRepo.findOne({
      where: { configType: 'real_name_verify' },
    });
    if (!config) return null;
    return {
      id: config.id,
      configType: config.configType,
      productCode: config.productCode,
      endpointType: config.endpointType || 'common',
      paramType: config.paramType || 'md5',
      region: config.region,
      accessKey: this.maskSensitive(config.accessKey),
      secretKey: this.maskSensitive(config.secretKey),
    };
  }

  async saveVerifyConfig(dto: {
    accessKey: string;
    secretKey: string;
    productCode: string;
    endpointType?: 'common' | 'beijing' | 'shanghai';
    paramType?: 'normal' | 'md5' | 'sm2';
    region?: string;
  }): Promise<void> {
    let config = await this.configRepo.findOne({
      where: { configType: 'real_name_verify' },
    });
    if (!config) {
      config = this.configRepo.create({ configType: 'real_name_verify' });
    }
    if (dto.accessKey && dto.accessKey !== '********') {
      config.accessKey = CryptoUtil.encrypt(dto.accessKey);
    }
    if (dto.secretKey && dto.secretKey !== '********') {
      config.secretKey = CryptoUtil.encrypt(dto.secretKey);
    }
    config.productCode = dto.productCode;
    if (dto.endpointType) config.endpointType = dto.endpointType;
    if (dto.paramType) config.paramType = dto.paramType;
    if (dto.region !== undefined) config.region = dto.region || null;
    await this.configRepo.save(config);
    await this.invalidateCache('real_name_verify');
    this.logger.log('Aliyun real-name verify config updated');
  }

  async getDecryptedSmsConfig(): Promise<AliyunConfigEntity> {
    const config = await this.configRepo.findOne({ where: { configType: 'sms' } });
    if (!config) {
      throw new ServiceUnavailableException('Aliyun SMS config not found');
    }
    config.accessKey = CryptoUtil.decrypt(config.accessKey);
    config.secretKey = CryptoUtil.decrypt(config.secretKey);
    return config;
  }

  async getDecryptedVerifyConfig(): Promise<AliyunConfigEntity> {
    const config = await this.configRepo.findOne({
      where: { configType: 'real_name_verify' },
    });
    if (!config) {
      throw new ServiceUnavailableException('Aliyun verify config not found');
    }
    config.accessKey = CryptoUtil.decrypt(config.accessKey);
    config.secretKey = CryptoUtil.decrypt(config.secretKey);
    return config;
  }

  private async invalidateCache(configType: string): Promise<void> {
    await this.redisService.del(`cache:aliyun-config:${configType}`);
  }

  private maskSensitive(value: string): string {
    if (!value || value.length < 8) return '********';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  }
}
