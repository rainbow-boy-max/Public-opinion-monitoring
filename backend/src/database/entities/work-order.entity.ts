import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WorkOrderStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum WorkOrderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum WorkOrderType {
  EVENT = 'event',
  ALERT = 'alert',
  MANUAL = 'manual',
}

@Entity('work_orders')
export class WorkOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: number | null;

  @Column({ length: 32 })
  type: WorkOrderType;

  @Column({ name: 'event_id', type: 'bigint', nullable: true })
  eventId: number | null;

  @Column({ length: 256 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ length: 16, default: 'medium' })
  priority: WorkOrderPriority;

  @Column({ length: 16, default: 'pending' })
  status: WorkOrderStatus;

  @Column({ type: 'text', nullable: true })
  analysis: string | null;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ name: 'resolution_type', length: 32, nullable: true })
  resolutionType: string | null;

  @Column({ name: 'due_at', type: 'datetime', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
