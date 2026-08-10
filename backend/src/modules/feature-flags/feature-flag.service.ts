import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from '../../database/entities/feature-flag.entity';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cache: Map<string, boolean> = new Map();

  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly flagRepo: Repository<FeatureFlagEntity>,
  ) {}

  async listFlags(): Promise<FeatureFlagEntity[]> {
    const flags = await this.flagRepo.find({ order: { sort: 'ASC' } });
    return flags.map((f) => ({ ...f, isEnabled: !!f.isEnabled })) as FeatureFlagEntity[];
  }

  async getFlag(key: string): Promise<boolean> {
    if (this.cache.has(key)) return this.cache.get(key) ?? true;
    try {
      const flag = await this.flagRepo.findOne({ where: { key } });
      const enabled = flag ? flag.isEnabled : true;
      this.cache.set(key, enabled);
      return enabled;
    } catch {
      return true;
    }
  }

  async setFlag(key: string, enabled: boolean): Promise<FeatureFlagEntity> {
    let flag = await this.flagRepo.findOne({ where: { key } });
    if (!flag) {
      flag = this.flagRepo.create({ key, name: key, isEnabled: enabled });
    } else {
      flag.isEnabled = enabled;
    }
    await this.flagRepo.save(flag);
    this.cache.set(key, enabled);
    this.logger.log(`Feature flag "${key}" set to ${enabled}`);
    return flag;
  }

  async setManyFlags(flags: Array<{ key: string; enabled: boolean }>): Promise<void> {
    for (const f of flags) {
      await this.setFlag(f.key, f.enabled);
    }
  }

  async checkFlag(key: string): Promise<{ key: string; enabled: boolean }> {
    const enabled = await this.getFlag(key);
    return { key, enabled };
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}