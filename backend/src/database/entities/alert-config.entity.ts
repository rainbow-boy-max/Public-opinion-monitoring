import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AlertLevel {
  NORMAL = 'normal',
  IMPORTANT = 'important',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  SMS = 'sms',
  EMAIL = 'email',
  WECHAT = 'wechat',
  DINGTALK = 'dingtalk',
  INTERNAL = 'internal',
}

export interface TriggerConditions {
  readCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  sentiment?: string[];
  keywords?: string[];
}

export interface AlertRecipients {
  phone?: string[];
  email?: string[];
  wechat?: string[];
  dingtalk?: string[];
}

export interface QuietHours {
  start: string;
  end: string;
}

@Entity('alert_configs')
export class AlertConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'alert_level', type: 'varchar', length: 32 })
  alertLevel: AlertLevel;

  @Column({ name: 'enabled_channels', type: 'json', comment: '启用的通知渠道' })
  enabledChannels: AlertChannel[];

  @Column({ name: 'quiet_hours', type: 'json', nullable: true, comment: '免打扰时段' })
  quietHours: QuietHours | null;

  @Column({ name: 'recipients', type: 'json', comment: '接收人列表' })
  recipients: AlertRecipients;

  @Column({ name: 'trigger_conditions', type: 'json', comment: '触发条件' })
  triggerConditions: TriggerConditions;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
