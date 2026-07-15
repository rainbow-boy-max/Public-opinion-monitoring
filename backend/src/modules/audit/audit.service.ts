import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { AuditEventEntity, AuditActorType } from '../../database/entities';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repo: Repository<AuditEventEntity>,
  ) {}

  async log(params: {
    actorId: number | null;
    actorType: AuditActorType;
    module: string;
    action: string;
    resourceType?: string | null;
    resourceId?: number | null;
    title: string;
    content?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.repo.save({
        actorId: params.actorId,
        actorType: params.actorType,
        module: params.module,
        action: params.action,
        resourceType: params.resourceType || null,
        resourceId: params.resourceId || null,
        title: params.title,
        content: params.content || null,
        ipAddress: params.ipAddress || null,
      });
    } catch (err) {
      this.logger.warn(`audit.log failed (${params.module}/${params.action}): ${(err as Error).message}`);
    }
  }

  async query(params: {
    page?: number;
    pageSize?: number;
    module?: string;
    action?: string;
    actorId?: number;
    resourceType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ items: AuditEventEntity[]; total: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize) || 20));

    const qb = this.repo.createQueryBuilder('a').orderBy('a.created_at', 'DESC');

    if (params.module) {
      qb.andWhere('a.module = :module', { module: params.module });
    }
    if (params.action) {
      qb.andWhere('a.action = :action', { action: params.action });
    }
    if (params.actorId) {
      qb.andWhere('a.actor_id = :actorId', { actorId: params.actorId });
    }
    if (params.resourceType) {
      qb.andWhere('a.resource_type = :resourceType', { resourceType: params.resourceType });
    }
    if (params.startDate) {
      qb.andWhere('a.created_at >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('a.created_at <= :endDate', { endDate: params.endDate });
    }
    if (params.search) {
      const search = `%${params.search}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('a.title LIKE :search', { search }).orWhere('a.content LIKE :search', { search });
        }),
      );
    }

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async getModules(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.module', 'module')
      .orderBy('a.module', 'ASC')
      .getRawMany();
    return rows.map((r) => r.module);
  }

  async getActions(module?: string): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action')
      .orderBy('a.action', 'ASC');

    if (module) {
      qb.where('a.module = :module', { module });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => r.action);
  }
}
