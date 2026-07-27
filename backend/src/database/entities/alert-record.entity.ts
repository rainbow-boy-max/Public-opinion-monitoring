import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OpinionEventEntity } from './opinion-event.entity';
import { AlertLevel, AlertChannel } from './alert-config.entity';

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CONFIRMED = 'confirmed',
}

@Entity('alert_records')
export class AlertRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Index()
  @Column({ name: 'alert_level', type: 'varchar', length: 32 })
  alertLevel: AlertLevel;

  @Column({ name: 'alert_channel', type: 'varchar', length: 32 })
  alertChannel: AlertChannel;

  @Column({ name: 'recipient', type: 'varchar', length: 255, comment: '接收人' })
  recipient: string;

  @Column({ type: 'varchar', length: 32, default: AlertStatus.PENDING })
  status: AlertStatus;

  @Column({ type: 'text', comment: '预警内容' })
  content: string;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true })
  confirmedBy: number | null;

  @Column({ type: 'text', nullable: true, comment: '处理反馈' })
  feedback: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
