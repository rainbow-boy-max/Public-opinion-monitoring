import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ScheduleFreq {
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

@Entity('report_schedules')
export class ReportScheduleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ length: 128 })
  name: string;

  @Column({
    type: 'varchar', length: 16,
    enum: ScheduleFreq,
  })
  freq: 'daily' | 'weekly';

  @Column({ name: 'task_ids', type: 'text' })
  taskIds: string;

  @Column({ length: 5 })
  time: string;

  @Column({ name: 'next_run_at', type: 'datetime', nullable: true })
  nextRunAt: Date | null;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
