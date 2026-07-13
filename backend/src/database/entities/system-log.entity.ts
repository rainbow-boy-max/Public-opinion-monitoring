import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_logs')
@Index('idx_module_time', ['module', 'createdAt'])
export class SystemLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'operator_id', type: 'bigint', nullable: true })
  operatorId: number | null;

  @Column({
    type: 'enum',
    enum: ['info', 'warn', 'error'],
    default: 'info',
  })
  level: 'info' | 'warn' | 'error';

  @Column({ length: 64 })
  module: string;

  @Column({ length: 128 })
  action: string;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}