import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertConfigEntity } from '../../database/entities/alert-config.entity';

@Injectable()
export class AlertConfigService {
  constructor(
    @InjectRepository(AlertConfigEntity)
    private readonly configRepo: Repository<AlertConfigEntity>,
  ) {}

  async getConfigByUserId(userId: number): Promise<AlertConfigEntity | null> {
    return this.configRepo.findOne({ where: { userId } });
  }

  async createOrUpdateConfig(data: Partial<AlertConfigEntity>): Promise<AlertConfigEntity> {
    const existing = await this.configRepo.findOne({ where: { userId: data.userId } });
    
    if (existing) {
      await this.configRepo.update({ id: existing.id }, data);
      return this.configRepo.findOne({ where: { id: existing.id } });
    } else {
      const config = this.configRepo.create(data);
      return this.configRepo.save(config);
    }
  }

  async getAllConfigs(): Promise<AlertConfigEntity[]> {
    return this.configRepo.find({ where: { isEnabled: true } });
  }
}
