import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { WebhookEntity } from './webhook.entity';
import { MonitorTaskEntity } from './monitor-task.entity';

@Entity('webhook_task_bindings')
@Unique('uniq_webhook_task', ['webhookId', 'taskId'])
export class WebhookTaskBindingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'webhook_id', type: 'bigint' })
  webhookId: number;

  @ManyToOne(() => WebhookEntity)
  @JoinColumn({ name: 'webhook_id' })
  webhook: WebhookEntity;

  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @ManyToOne(() => MonitorTaskEntity)
  @JoinColumn({ name: 'task_id' })
  task: MonitorTaskEntity;

  @Column({
    type: 'varchar', length: 32,
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}