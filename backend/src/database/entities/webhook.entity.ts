import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum WebhookFormat {
  WECOM = 'wecom',
  DINGTALK = 'dingtalk',
  FEISHU = 'feishu',
  CUSTOM_JSON = 'custom_json',
}

export enum PeriodicFreq {
  HOURLY = 'hourly',
  EVERY_6H = 'every_6h',
  DAILY = 'daily',
}

export enum WebhookStatus {
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled',
}

@Entity('webhooks')
export class WebhookEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 512 })
  url: string;

  @Column({
    type: 'enum',
    enum: WebhookFormat,
    default: WebhookFormat.CUSTOM_JSON,
  })
  format: WebhookFormat;

  @Column({ name: 'secret_key', length: 128, nullable: true })
  secretKey: string | null;

  @Column({ name: 'ingest_token', length: 128 })
  ingestToken: string;

  @Column({ name: 'sms_alert_enabled', type: 'tinyint', default: 0 })
  smsAlertEnabled: number;

  @Column({ name: 'push_on_match', type: 'tinyint', default: 1 })
  pushOnMatch: number;

  @Column({ name: 'push_periodic', type: 'tinyint', default: 0 })
  pushPeriodic: number;

  @Column({
    name: 'periodic_freq',
    type: 'enum',
    enum: PeriodicFreq,
    nullable: true,
  })
  periodicFreq: PeriodicFreq | null;

  @Column({ name: 'periodic_time', length: 8, nullable: true })
  periodicTime: string | null;

  @Column({ name: 'last_push_at', type: 'datetime', nullable: true })
  lastPushAt: Date | null;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}