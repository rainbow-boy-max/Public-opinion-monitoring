import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WebhookEntity } from './webhook.entity';
import { OpinionEventEntity } from './opinion-event.entity';

@Entity('webhook_push_logs')
export class WebhookPushLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'webhook_id', type: 'bigint' })
  webhookId: number;

  @ManyToOne(() => WebhookEntity)
  @JoinColumn({ name: 'webhook_id' })
  webhook: WebhookEntity;

  @Column({ name: 'event_id', type: 'bigint', nullable: true })
  eventId: number | null;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity | null;

  @Column({ name: 'http_status', type: 'int' })
  httpStatus: number;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({
    type: 'enum',
    enum: ['success', 'failed', 'timeout'],
  })
  result: 'success' | 'failed' | 'timeout';

  @Column({ name: 'duration_ms', type: 'decimal', precision: 10, scale: 2 })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}