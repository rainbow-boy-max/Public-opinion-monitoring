import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('api_usage_logs')
export class ApiUsageLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'api_key_id' })
  apiKeyId: number;

  @Column({ length: 128 })
  endpoint: string;

  @Column({ length: 8 })
  method: string;

  @Column({ type: 'int', default: 200 })
  statusCode: number;

  @Column({ name: 'response_ms', type: 'int', default: 0 })
  responseMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
