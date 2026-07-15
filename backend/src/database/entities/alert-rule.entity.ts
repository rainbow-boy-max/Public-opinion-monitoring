import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AlertConditionType {
  SENTIMENT_NEGATIVE = 'sentiment_negative',
  VOLUME_SPIKE = 'volume_spike',
  KEYWORD_MATCH = 'keyword_match',
  PLATFORM_SPECIFIC = 'platform_specific',
}

export enum AlertChannel {
  INTERNAL = 'internal',
  WEBHOOK = 'webhook',
  SMS = 'sms',
}

export enum AlertRuleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
}

@Entity('alert_rules')
export class AlertRuleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column({ length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 32 })
  conditionType: AlertConditionType;

  @Column({ type: 'text' })
  conditionConfig: string;

  @Column({ type: 'varchar', length: 32 })
  channel: AlertChannel;

  @Column({ type: 'text', nullable: true })
  channelConfig: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: AlertRuleStatus;

  @Column({ name: 'last_triggered_at', type: 'datetime', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ name: 'cooldown_minutes', type: 'int', default: 60 })
  cooldownMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
