import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaptchaConfigEntity } from '../../database/entities/captcha-config.entity';

export interface CaptchaConfig {
  isEnabled: boolean;
  region: string;
  prefix: string;
  sceneId: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(
    @InjectRepository(CaptchaConfigEntity)
    private readonly configRepo: Repository<CaptchaConfigEntity>,
  ) {}

  async getConfig(): Promise<CaptchaConfig> {
    const configs = await this.configRepo.find({ take: 1, order: { id: 'ASC' } });
    const cfg = configs[0];
    if (!cfg) {
      return {
        isEnabled: false, region: 'cn', prefix: '', sceneId: '',
        accessKeyId: '', accessKeySecret: '', endpoint: 'captcha.cn-shanghai.aliyuncs.com',
      };
    }
    return {
      isEnabled: cfg.isEnabled,
      region: cfg.region,
      prefix: cfg.prefix || '',
      sceneId: cfg.sceneId || '',
      accessKeyId: cfg.accessKeyId || '',
      accessKeySecret: cfg.accessKeySecret || '',
      endpoint: cfg.endpoint,
    };
  }

  async updateConfig(dto: Partial<CaptchaConfig>): Promise<CaptchaConfig> {
    let configs = await this.configRepo.find({ take: 1, order: { id: 'ASC' } });
    let cfg = configs[0];
    if (!cfg) {
      cfg = this.configRepo.create({
        isEnabled: false, region: 'cn', prefix: '', sceneId: '',
        accessKeyId: '', accessKeySecret: '', endpoint: 'captcha.cn-shanghai.aliyuncs.com',
      });
    }
    if (dto.isEnabled !== undefined) cfg.isEnabled = dto.isEnabled;
    if (dto.region !== undefined) cfg.region = dto.region;
    if (dto.prefix !== undefined) cfg.prefix = dto.prefix;
    if (dto.sceneId !== undefined) cfg.sceneId = dto.sceneId;
    if (dto.accessKeyId !== undefined) cfg.accessKeyId = dto.accessKeyId;
    if (dto.accessKeySecret !== undefined) cfg.accessKeySecret = dto.accessKeySecret;
    if (dto.endpoint !== undefined) cfg.endpoint = dto.endpoint;
    await this.configRepo.save(cfg);
    return this.getConfig();
  }

  async verify(captchaVerifyParam: string, sceneId?: string): Promise<boolean> {
    const cfg = await this.getConfig();
    if (!cfg.isEnabled) {
      this.logger.debug('Captcha disabled, skipping verification');
      return true;
    }

    // P1-10: 验证码已启用但未配置密钥时，拒绝而非放行
    if (!cfg.accessKeyId || !cfg.accessKeySecret) {
      this.logger.error('Captcha enabled but no access key configured - REJECTING');
      throw new Error('验证码服务配置不完整，请联系管理员');
    }

    try {
      const result = await this.callAliyunVerify(cfg, captchaVerifyParam, sceneId || cfg.sceneId);
      if (result) {
        this.logger.debug('Captcha verification passed');
      } else {
        this.logger.warn('Captcha verification failed');
      }
      return result;
    } catch (err) {
      // P1-10: 验证码服务异常时，拒绝而非放行
      this.logger.error(`Captcha verification error: ${(err as Error).message} - REJECTING`);
      throw new Error('验证码服务异常，请稍后重试');
    }
  }

  private async callAliyunVerify(
    cfg: CaptchaConfig,
    captchaVerifyParam: string,
    sceneId: string,
  ): Promise<boolean> {
    const url = `https://${cfg.endpoint}/verify/verifyCaptcha`;
    const body = JSON.stringify({
      CaptchaVerifyParam: captchaVerifyParam,
      SceneId: sceneId,
    });

    const auth = Buffer.from(`${cfg.accessKeyId}:${cfg.accessKeySecret}`).toString('base64');

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      this.logger.error(`Aliyun captcha API returned ${resp.status} - REJECTING`);
      throw new Error(`验证码服务返回错误：${resp.status}`);
    }

    const data = await resp.json() as any;
    return data?.Result?.VerifyResult === true;
  }
}