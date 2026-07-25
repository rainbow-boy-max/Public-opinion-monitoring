import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShortVideoConfigEntity, PlatformType } from '../../database/entities/short-video-config.entity';
import { AliyunVideoConfigEntity } from '../../database/entities/aliyun-video-config.entity';

@Injectable()
export class ShortVideoConfigService {
  constructor(
    @InjectRepository(ShortVideoConfigEntity)
    private readonly configRepo: Repository<ShortVideoConfigEntity>,
    @InjectRepository(AliyunVideoConfigEntity)
    private readonly aliyunConfigRepo: Repository<AliyunVideoConfigEntity>,
  ) {}

  async getPlatformConfig(platform: PlatformType): Promise<ShortVideoConfigEntity | null> {
    return this.configRepo.findOne({ where: { platform } });
  }

  async getAllPlatformConfigs(): Promise<ShortVideoConfigEntity[]> {
    return this.configRepo.find({ order: { platform: 'ASC' } });
  }

  async upsertPlatformConfig(data: Partial<ShortVideoConfigEntity>): Promise<ShortVideoConfigEntity> {
    const existing = await this.configRepo.findOne({ where: { platform: data.platform } });
    
    if (existing) {
      await this.configRepo.update(existing.id, data);
      return this.configRepo.findOne({ where: { id: existing.id } });
    }
    
    return this.configRepo.save(data);
  }

  async getAliyunConfig(): Promise<AliyunVideoConfigEntity | null> {
    const configs = await this.aliyunConfigRepo.find({ take: 1 });
    return configs.length > 0 ? configs[0] : null;
  }

  async upsertAliyunConfig(data: Partial<AliyunVideoConfigEntity>): Promise<AliyunVideoConfigEntity> {
    const existing = await this.getAliyunConfig();
    
    if (existing) {
      await this.aliyunConfigRepo.update(existing.id, data);
      return this.aliyunConfigRepo.findOne({ where: { id: existing.id } });
    }
    
    return this.aliyunConfigRepo.save(data);
  }

  async testPlatformConnection(platform: PlatformType): Promise<{ success: boolean; message: string }> {
    const config = await this.getPlatformConfig(platform);
    
    if (!config || !config.isEnabled) {
      return { success: false, message: '平台配置未启用' };
    }

    if (!config.appKey || !config.appSecret) {
      return { success: false, message: '缺少 App Key 或 App Secret' };
    }

    return { success: true, message: '连接测试成功（Mock）' };
  }

  async testAliyunConnection(): Promise<{ success: boolean; message: string }> {
    const config = await this.getAliyunConfig();
    
    if (!config || !config.isEnabled) {
      return { success: false, message: '阿里云配置未启用' };
    }

    if (!config.accessKeyId || !config.accessKeySecret) {
      return { success: false, message: '缺少 Access Key' };
    }

    return { success: true, message: '连接测试成功（Mock）' };
  }
}
