import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('kb_scoring_configs')
export class KbScoringConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'primary_model_id', type: 'bigint', default: 0 })
  primaryModelId: number;

  @Column({ name: 'fallback_model_ids', type: 'json', nullable: true })
  fallbackModelIds: number[];

  @Column({ name: 'enable_web_search', type: 'tinyint', default: 0 })
  enableWebSearch: number;

  @Column({ name: 'enable_vision', type: 'tinyint', default: 0 })
  enableVision: number;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
