import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type BriefingType = 'daily' | 'weekly' | 'special';
export type BriefingStatus = 'draft' | 'generated' | 'submitted';

@Entity('gov_briefings')
export class GovBriefingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'briefing_type', type: 'varchar', length: 32 })
  briefingType: BriefingType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: BriefingStatus;

  @Column({ name: 'export_format', type: 'varchar', length: 32, nullable: true })
  exportFormat: 'word' | 'pdf' | null;

  @Column({ name: 'export_url', type: 'varchar', length: 500, nullable: true })
  exportUrl: string | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'submitted_to', type: 'varchar', length: 255, nullable: true })
  submittedTo: string | null;

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
