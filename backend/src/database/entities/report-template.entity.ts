import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type TemplateType = 'daily' | 'weekly' | 'event' | 'competitor' | 'custom';

@Entity('report_templates')
export class ReportTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 256 })
  description: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ name: 'template_type', length: 32 })
  templateType: TemplateType;

  @Column({ type: 'text', nullable: true })
  structure: string;

  @Column({ name: 'icon', length: 64, default: 'file-text' })
  icon: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive: number;

  @Column({ name: 'is_preset', type: 'tinyint', default: 0 })
  isPreset: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
