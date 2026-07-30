import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  BriefingType,
  GovBriefingEntity,
} from '../../database/entities/gov-briefing.entity';
import type { BriefingStatus } from '../../database/entities/gov-briefing.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';

@Injectable()
export class GovBriefingService {
  constructor(
    @InjectRepository(GovBriefingEntity)
    private readonly briefingRepo: Repository<GovBriefingEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async generate(data: {
    briefingType: BriefingType;
    startDate: Date;
    endDate: Date;
    title?: string;
    createdBy: number;
  }): Promise<GovBriefingEntity> {
    this.assertDateRange(data.startDate, data.endDate);

    const events = await this.collectEvents(data.startDate, data.endDate);
    const briefing = this.briefingRepo.create({
      briefingType: data.briefingType,
      title: data.title || this.defaultTitle(data.briefingType, data.startDate),
      startDate: data.startDate,
      endDate: data.endDate,
      content: this.buildContent(data.briefingType, data.startDate, data.endDate, events),
      status: 'generated',
      exportFormat: null,
      exportUrl: null,
      submittedAt: null,
      submittedTo: null,
      createdBy: data.createdBy,
    });

    return this.briefingRepo.save(briefing);
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    briefingType?: BriefingType;
    status?: BriefingStatus;
  }): Promise<{ data: GovBriefingEntity[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
    const query = this.briefingRepo.createQueryBuilder('briefing');

    if (params.briefingType) {
      query.andWhere('briefing.briefingType = :briefingType', {
        briefingType: params.briefingType,
      });
    }
    if (params.status) {
      query.andWhere('briefing.status = :status', { status: params.status });
    }

    query
      .orderBy('briefing.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async getById(id: number): Promise<GovBriefingEntity> {
    const briefing = await this.briefingRepo.findOne({ where: { id } });
    if (!briefing) {
      throw new NotFoundException('政务简报不存在');
    }
    return briefing;
  }

  async submit(id: number, submittedTo: string): Promise<GovBriefingEntity> {
    const briefing = await this.getById(id);
    if (briefing.status === 'draft' || !briefing.content.trim()) {
      throw new BadRequestException('简报尚未生成，无法上报');
    }

    briefing.status = 'submitted';
    briefing.submittedAt = new Date();
    briefing.submittedTo = submittedTo;
    return this.briefingRepo.save(briefing);
  }

  private async collectEvents(startDate: Date, endDate: Date): Promise<OpinionEventEntity[]> {
    const inclusiveEnd = new Date(endDate);
    inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
    inclusiveEnd.setMilliseconds(-1);

    return this.eventRepo.find({
      where: { createdAt: Between(startDate, inclusiveEnd) },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private assertDateRange(startDate: Date, endDate: Date): void {
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.getTime() > endDate.getTime()
    ) {
      throw new BadRequestException('简报开始日期不能晚于结束日期');
    }
  }

  private defaultTitle(type: BriefingType, startDate: Date): string {
    const date = startDate.toISOString().slice(0, 10);
    const names: Record<BriefingType, string> = {
      daily: '舆情监测日报',
      weekly: '舆情监测周报',
      special: '舆情监测专报',
    };
    return `${names[type]}（${date}）`;
  }

  private buildContent(
    type: BriefingType,
    startDate: Date,
    endDate: Date,
    events: OpinionEventEntity[],
  ): string {
    const negativeCount = events.filter((event) => event.sentiment === 'negative').length;
    const positiveCount = events.filter((event) => event.sentiment === 'positive').length;
    const neutralCount = events.length - negativeCount - positiveCount;
    const topEvents = events
      .slice(0, 5)
      .map((event, index) => `${index + 1}. ${event.title}（${event.platform}，${event.sentiment}）`)
      .join('\n');
    const period = `${startDate.toISOString().slice(0, 10)} 至 ${endDate.toISOString().slice(0, 10)}`;

    return [
      `# ${type === 'daily' ? '舆情监测日报' : type === 'weekly' ? '舆情监测周报' : '舆情监测专报'}`,
      `时间范围：${period}`,
      '',
      '## 一、舆情概览',
      `监测事件数：${events.length}`,
      `情感分布：正面 ${positiveCount}，中性 ${neutralCount}，负面 ${negativeCount}`,
      '',
      '## 二、重点事件',
      topEvents || '暂无重点事件',
      '',
      '## 三、研判建议',
      negativeCount > 0 ? '建议重点核查负面舆情，持续跟踪传播范围和处置进展。' : '当前负面舆情较少，建议保持常态化监测。',
    ].join('\n');
  }
}
