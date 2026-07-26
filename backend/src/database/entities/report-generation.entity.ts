import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  SPECIAL = 'special',
}

export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ExportFormat {
  WORD = 'word',
  PDF = 'pdf',
}

@Entity('report_generations')
export class ReportGenerationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'report_type', type: 'varchar', length: 32 })
  reportType: ReportType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Index()
  @Column({ type: 'varchar', length: 32, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'longtext', nullable: true, comment: '报告内容（Markdown）' })
  content: string | null;

  @Column({ name: 'export_format', type: 'varchar', length: 32, nullable: true })
  exportFormat: ExportFormat | null;

  @Column({ name: 'export_url', type: 'text', nullable: true })
  exportUrl: string | null;

  @Index()
  @Column({ name: 'created_by', type: 'bigint' })
  createdBy: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
}
