import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventEntity, AuditActorType } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';

export const DASHBOARD_ACTIVITY_CHANNEL = 'admin:dashboard:activity';

export interface AuditRecordInput {
  actorId?: number | null;
  actorType?: AuditActorType;
  module: string;
  action: string;
  resourceType?: string | null;
  resourceId?: number | null;
  title: string;
  content?: string;
  ipAddress?: string | null;
}

export interface ActivityItem {
  id: number;
  module: string;
  action: string;
  title: string;
  content?: string | null;
  type: 'primary' | 'success' | 'info' | 'warning' | 'danger';
  createdAt: string;
  actionTarget?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repo: Repository<AuditEventEntity>,
    private readonly redisService: RedisService,
  ) {}

  async record(input: AuditRecordInput): Promise<AuditEventEntity | null> {
    let saved: AuditEventEntity | null = null;
    try {
      const created = this.repo.create({
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? 'admin',
        module: input.module,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        title: input.title,
        content: input.content ?? null,
        ipAddress: input.ipAddress ?? null,
      });
      saved = await this.repo.save(created);
    } catch (err) {
      this.logger.warn(
        `audit.record failed (${input.module}/${input.action}): ${(err as Error).message}`,
      );
      return null;
    }

    void this.publishActivity(this.toActivity(saved)).catch((err) =>
      this.logger.warn(`publish activity failed: ${(err as Error).message}`),
    );

    return saved;
  }

  async list(opts: {
    page?: number;
    pageSize?: number;
    module?: string;
    action?: string;
    resourceType?: string;
    resourceId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: AuditEventEntity[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(opts.pageSize) || 20));

    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (opts.module) qb.andWhere('a.module = :module', { module: opts.module });
    if (opts.action) qb.andWhere('a.action = :action', { action: opts.action });
    if (opts.resourceType) qb.andWhere('a.resource_type = :rt', { rt: opts.resourceType });
    if (opts.resourceId !== undefined && opts.resourceId !== null) {
      qb.andWhere('a.resource_id = :rid', { rid: opts.resourceId });
    }
    if (opts.startDate) qb.andWhere('a.created_at >= :sd', { sd: opts.startDate });
    if (opts.endDate) qb.andWhere('a.created_at <= :ed', { ed: opts.endDate });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async recent(limit = 20): Promise<ActivityItem[]> {
    const items = await this.repo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return items.map((it) => this.toActivity(it));
  }

  async publishActivity(item: ActivityItem): Promise<void> {
    try {
      await this.redisService.publish(
        DASHBOARD_ACTIVITY_CHANNEL,
        JSON.stringify(item),
      );
    } catch (err) {
      this.logger.warn(`publish activity failed: ${(err as Error).message}`);
    }
  }

  toActivity(it: AuditEventEntity): ActivityItem {
    const createdAt = (it.createdAt instanceof Date
      ? it.createdAt
      : new Date(it.createdAt)
    ).toISOString();
    const type = this.mapType(it.module, it.action);
    const actionTarget = this.mapActionTarget(it);
    return {
      id: it.id,
      module: it.module,
      action: it.action,
      title: it.title,
      content: it.content,
      type,
      createdAt,
      actionTarget,
    };
  }

  private mapType(module: string, action: string): ActivityItem['type'] {
    if (action === 'test-success') return 'success';
    if (action === 'test-fail' || action === 'fail') return 'danger';
    if (action === 'parse-fail') return 'warning';
    if (module === 'auth' || action === 'login' || action === 'logout') return 'info';
    return 'primary';
  }

  private mapActionTarget(it: AuditEventEntity): string | null {
    if (it.module === 'agents' && it.resourceId) return `/agents/${it.resourceId}`;
    if (it.module === 'llm-models' && it.resourceId) return `/llm-models?id=${it.resourceId}`;
    if (it.module === 'users' && it.resourceId) return `/users?id=${it.resourceId}`;
    return null;
  }
}
