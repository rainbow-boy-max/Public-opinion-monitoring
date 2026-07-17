import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKeyEntity, ApiUsageLogEntity } from '../../database/entities';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKeyEntity) private apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiUsageLogEntity) private usageRepo: Repository<ApiUsageLogEntity>,
  ) {}

  async create(userId: number, data: { name: string; permissions?: string; rateLimit?: number }): Promise<{ key: string; id: number; name: string }> {
    const rawKey = `om_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const existing = await this.apiKeyRepo.findOne({ where: { key: keyHash } });
    if (existing) {
      throw new ConflictException('Key collision, please retry');
    }

    const entity = this.apiKeyRepo.create({
      userId,
      key: keyHash,
      name: data.name,
      permissions: data.permissions || null,
      rateLimit: data.rateLimit || 100,
    });
    const saved = await this.apiKeyRepo.save(entity);
    return { key: rawKey, id: saved.id, name: saved.name };
  }

  async findByUser(userId: number): Promise<ApiKeyEntity[]> {
    return this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(userId: number, id: number): Promise<void> {
    const key = await this.apiKeyRepo.findOne({ where: { id, userId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.apiKeyRepo.remove(key);
  }

  async toggle(userId: number, id: number): Promise<ApiKeyEntity> {
    const key = await this.apiKeyRepo.findOne({ where: { id, userId } });
    if (!key) throw new NotFoundException('API key not found');
    key.isActive = key.isActive ? 0 : 1;
    return this.apiKeyRepo.save(key);
  }

  async getStats(userId: number): Promise<any> {
    const keys = await this.apiKeyRepo.find({ where: { userId } });
    const keyIds = keys.map(k => k.id);

    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => k.isActive).length;

    const totalCalls = keyIds.length > 0
      ? await this.usageRepo.count({ where: { apiKeyId: keyIds.length === 1 ? keyIds[0] : 0 as any } })
      : 0;

    return { totalKeys, activeKeys, totalCalls };
  }

  async validateAndLog(key: string, endpoint: string, method: string): Promise<{ valid: boolean; userId?: number }> {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const entity = await this.apiKeyRepo.findOne({ where: { key: keyHash, isActive: 1 } });
    if (!entity) return { valid: false };

    if (entity.expiresAt && new Date() > entity.expiresAt) {
      entity.isActive = 0;
      await this.apiKeyRepo.save(entity);
      return { valid: false };
    }

    entity.lastUsedAt = new Date();
    await this.apiKeyRepo.save(entity);

    const log = this.usageRepo.create({
      apiKeyId: entity.id,
      endpoint,
      method,
      statusCode: 200,
    });
    await this.usageRepo.save(log);

    return { valid: true, userId: entity.userId };
  }
}
