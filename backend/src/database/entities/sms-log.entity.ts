import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sms_logs')
@Index('idx_phone_time', ['phone', 'createdAt'])
export class SmsLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ length: 20 })
  phone: string;

  @Column({
    type: 'varchar', length: 32,
    enum: ['login', 'register', 'reset', 'notify', 'alert'],
  })
  scene: 'login' | 'register' | 'reset' | 'notify' | 'alert';

  @Column({ name: 'template_code', length: 64 })
  templateCode: string;

  @Column({
    type: 'varchar', length: 32,
    enum: ['sent', 'success', 'failed'],
  })
  status: 'sent' | 'success' | 'failed';

  @Column({ name: 'error_code', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}