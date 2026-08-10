import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';

export interface EvidenceRecord {
  hash: string;
  previousHash: string;
  timestamp: string;
  data: string;
  blockIndex: number;
  chainId: string;
}

export interface EvidenceChain {
  chainId: string;
  blocks: EvidenceRecord[];
  rootHash: string;
  blockCount: number;
  createdAt: Date;
}

@Injectable()
export class BlockchainEvidenceService {
  private readonly logger = new Logger(BlockchainEvidenceService.name);
  private readonly chainPrefix = 'evidence:';
  private chains = new Map<string, EvidenceRecord[]>();

  constructor(
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async createEvidence(
    eventId: number,
    reason?: string,
  ): Promise<EvidenceRecord> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new Error(`Event ${eventId} not found`);

    const evidenceData = JSON.stringify({
      eventId: event.id,
      title: event.title,
      content: event.content?.substring(0, 1000),
      platform: event.platform,
      author: event.author,
      publishTime: event.publishTime,
      url: event.url,
      sentiment: event.sentiment,
      matchedKeywords: event.matchedKeywords,
      reason: reason || '舆情事件存证',
      timestamp: new Date().toISOString(),
    });

    const chainId = `${this.chainPrefix}event:${event.id}`;
    const existingBlocks = this.chains.get(chainId) || [];
    const previousHash = existingBlocks.length > 0
      ? existingBlocks[existingBlocks.length - 1].hash
      : '0'.repeat(64);

    const blockData = `${previousHash}${evidenceData}${Date.now()}`;
    const hash = createHash('sha256').update(blockData).digest('hex');

    const record: EvidenceRecord = {
      hash,
      previousHash,
      timestamp: new Date().toISOString(),
      data: evidenceData,
      blockIndex: existingBlocks.length,
      chainId,
    };

    existingBlocks.push(record);
    this.chains.set(chainId, existingBlocks);

    this.logger.log(`Evidence created: event=${eventId}, hash=${hash.substring(0, 16)}...`);
    return record;
  }

  async getChain(eventId: number): Promise<EvidenceChain | null> {
    const chainId = `${this.chainPrefix}event:${eventId}`;
    const blocks = this.chains.get(chainId);
    if (!blocks || blocks.length === 0) return null;

    const rootHash = blocks.length > 0
      ? blocks[blocks.length - 1].hash
      : '0'.repeat(64);

    return {
      chainId,
      blocks,
      rootHash,
      blockCount: blocks.length,
      createdAt: new Date(blocks[0].timestamp),
    };
  }

  verifyChain(eventId: number): boolean {
    const chainId = `${this.chainPrefix}event:${eventId}`;
    const blocks = this.chains.get(chainId);
    if (!blocks || blocks.length === 0) return false;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const expectedPreviousHash = i > 0
        ? blocks[i - 1].hash
        : '0'.repeat(64);

      if (block.previousHash !== expectedPreviousHash) {
        this.logger.warn(`Chain tampered: block ${i} hash mismatch`);
        return false;
      }

      const recalculated = createHash('sha256')
        .update(`${block.previousHash}${block.data}${block.timestamp}`)
        .digest('hex');
      if (block.hash !== recalculated) {
        this.logger.warn(`Chain tampered: block ${i} data modified`);
        return false;
      }
    }

    return true;
  }

  getEvidenceHash(eventId: number): string | null {
    const chain = this.chains.get(`${this.chainPrefix}event:${eventId}`);
    if (!chain || chain.length === 0) return null;
    return chain[chain.length - 1].hash;
  }
}