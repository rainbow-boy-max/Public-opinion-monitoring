import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLogEntity } from '../../database/entities';

@Injectable()
export class SystemLogsService {
  constructor(
    @InjectRepository(SystemLogEntity) private logRepo: Repository<SystemLogEntity>,
  ) {}

  async log(
    level: 'info' | 'warn' | 'error',
    module: string,
    action: string,
    detail?: string,
    operatorId?: number,
    ipAddress?: string,
  ): Promise<void> {
    const log = this.logRepo.create({
      level,
      module,
      action,
      detail: detail || null,
      operatorId: operatorId || null,
      ipAddress: ipAddress || null,
    });
    await this.logRepo.save(log);
  }

  async list(params: {
    page: number;
    pageSize: number;
    module?: string;
    level?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: SystemLogEntity[]; total: number }> {
    const { page, pageSize, module: mod, level, startDate, endDate } = params;
    const qb = this.logRepo.createQueryBuilder('l');

    if (mod) qb.andWhere('l.module = :mod', { mod });
    if (level) qb.andWhere('l.level = :level', { level });
    if (startDate) qb.andWhere('l.created_at >= :start', { start: new Date(startDate) });
    if (endDate) qb.andWhere('l.created_at <= :end', { end: new Date(endDate) });

    qb.orderBy('l.id', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
