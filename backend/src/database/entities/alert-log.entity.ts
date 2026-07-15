import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('alert_logs')
export class AlertLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  ruleId: number;

  @Column()
  userId: number;

  @Column({ length: 256 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'text', nullable: true })
  triggerData: string;

  @Column({ length: 16, default: 'sent' })
  status: 'sent' | 'failed';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
