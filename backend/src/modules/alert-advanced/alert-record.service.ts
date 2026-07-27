import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRecordEntity, AlertStatus } from '../../database/entities/alert-record.entity';
import { AlertLevel, AlertChannel } from '../../database/entities/alert-config.entity';

@Injectable()
export class AlertRecordService {
  constructor(
    @InjectRepository(AlertRecordEntity)
    private readonly recordRepo: Repository<AlertRecordEntity>,
  ) {}

  async createRecord(data: {
    eventId: number;
    alertLevel: AlertLevel;
    alertChannel: AlertChannel;
    recipient: string;
    content: string;
  }): Promise<AlertRecordEntity> {
    const record = this.recordRepo.create({
      ...data,
      status: AlertStatus.PENDING,
    });
    return this.recordRepo.save(record);
  }

  async updateStatus(
    id: number,
    status: AlertStatus,
    errorMessage?: string,
  ): Promise<void> {
    const update: any = { status };
    if (status === AlertStatus.SENT) {
      update.sentAt = new Date();
    }
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    await this.recordRepo.update({ id }, update);
  }

  async confirmRecord(id: number, confirmedBy: number, feedback?: string): Promise<void> {
    await this.recordRepo.update(
      { id },
      {
        status: AlertStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedBy,
        feedback,
      },
    );
  }

  async getRecords(params: {
    page?: number;
    pageSize?: number;
    alertLevel?: AlertLevel;
    status?: AlertStatus;
  }): Promise<{ data: AlertRecordEntity[]; total: number }> {
    const { page = 1, pageSize = 20, alertLevel, status } = params;

    const query = this.recordRepo.createQueryBuilder('record')
      .leftJoinAndSelect('record.event', 'event');

    if (alertLevel) {
      query.andWhere('record.alertLevel = :alertLevel', { alertLevel });
    }

    if (status) {
      query.andWhere('record.status = :status', { status });
    }

    query.orderBy('record.createdAt', 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async getRecordById(id: number): Promise<AlertRecordEntity | null> {
    return this.recordRepo.findOne({
      where: { id },
      relations: ['event'],
    });
  }

  async checkDuplicate(eventId: number, alertLevel: AlertLevel): Promise<boolean> {
    const count = await this.recordRepo.count({
      where: {
        eventId,
        alertLevel,
        status: AlertStatus.SENT,
      },
    });
    return count > 0;
  }
}
