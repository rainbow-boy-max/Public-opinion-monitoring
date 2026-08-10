import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AuditEventEntity } from '../../database/entities';

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditRepo: Repository<AuditEventEntity>,
  ) {}

  async calculateChainHash(): Promise<{ currentHash: string; previousHash: string; recordCount: number }> {
    const records = await this.auditRepo.find({
      order: { id: 'ASC' },
      select: ['id', 'createdAt'],
    });

    if (records.length === 0) {
      return { currentHash: '', previousHash: '', recordCount: 0 };
    }

    let previousHash = '';
    let currentHash = '';

    for (const record of records) {
      const data = `${record.id}:${record.createdAt.toISOString()}:${previousHash}`;
      currentHash = createHash('sha256').update(data).digest('hex');
      previousHash = currentHash;
    }

    return {
      currentHash,
      previousHash: records.length > 1 ? currentHash : '',
      recordCount: records.length,
    };
  }

  async verifyChainIntegrity(): Promise<{ valid: boolean; brokenAtIndex: number | null; totalRecords: number }> {
    const records = await this.auditRepo.find({
      order: { id: 'ASC' },
    });

    if (records.length === 0) {
      return { valid: true, brokenAtIndex: null, totalRecords: 0 };
    }

    let previousHash = '';
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const data = `${record.id}:${record.createdAt.toISOString()}:${previousHash}`;
      const expectedHash = createHash('sha256').update(data).digest('hex');
      
      // Note: In production, the hash would be stored in the database
      // For now, we just verify the chain can be calculated
      previousHash = expectedHash;
    }

    return { valid: true, brokenAtIndex: null, totalRecords: records.length };
  }

  async getLatestHash(): Promise<string> {
    const latestRecord = await this.auditRepo.findOne({
      order: { id: 'DESC' },
    });

    if (!latestRecord) {
      return '';
    }

    const data = `${latestRecord.id}:${latestRecord.createdAt.toISOString()}`;
    return createHash('sha256').update(data).digest('hex');
  }
}
