import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { OpinionEventEntity, AuditEventEntity } from '../../database/entities';

export interface ArchiveConfig {
  /** 事件归档天数（默认 90 天前的事件归档） */
  eventRetentionDays: number;
  /** 归档后是否删除源数据（默认 false，仅标记） */
  deleteSource: boolean;
}

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);
  private config: ArchiveConfig = {
    eventRetentionDays: 90,
    deleteSource: false,
  };

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(AuditEventEntity)
    private auditRepo: Repository<AuditEventEntity>,
  ) {}

  updateConfig(cfg: Partial<ArchiveConfig>): void {
    Object.assign(this.config, cfg);
    this.logger.log(`Archive config updated: retention=${this.config.eventRetentionDays}d, deleteSource=${this.config.deleteSource}`);
  }

  getConfig(): ArchiveConfig {
    return { ...this.config };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyArchive(): Promise<void> {
    this.logger.log('Starting daily archive job...');
    const cutoff = new Date(Date.now() - this.config.eventRetentionDays * 24 * 60 * 60 * 1000);

    const oldEvents = await this.eventRepo.find({
      where: { matchedAt: LessThan(cutoff), archivedAt: null as any },
      select: ['id'],
      take: 1000,
    });

    if (oldEvents.length === 0) {
      this.logger.log('No events to archive');
      return;
    }

    const ids = oldEvents.map((e) => e.id);
    const now = new Date();

    if (this.config.deleteSource) {
      const result = await this.eventRepo.delete(ids);
      this.logger.log(`Archived (deleted) ${result.affected ?? ids.length} events older than ${cutoff.toISOString()}`);
    } else {
      await this.eventRepo.update(ids, { archivedAt: now } as any);
      this.logger.log(`Archived (marked) ${ids.length} events older than ${cutoff.toISOString()}`);
    }
  }

  async getArchiveStats(): Promise<{
    totalEvents: number;
    archivedEvents: number;
    activeEvents: number;
    retentionDays: number;
  }> {
    const totalEvents = await this.eventRepo.count();
    const archivedEvents = await this.eventRepo.count({
      where: { archivedAt: MoreThanOrEqual(new Date('2000-01-01')) as any },
    });
    return {
      totalEvents,
      archivedEvents,
      activeEvents: totalEvents - archivedEvents,
      retentionDays: this.config.eventRetentionDays,
    };
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupAuditLogs(): Promise<void> {
    this.logger.log('Starting audit log cleanup job...');
    const retentionMonths = 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);

    const result = await this.auditRepo.delete({
      createdAt: LessThan(cutoff),
    });

    this.logger.log(`Cleaned up ${result.affected ?? 0} audit logs older than ${cutoff.toISOString()}`);
  }
}