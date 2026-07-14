import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export type WebSearchProvider = 'duckduckgo' | 'brave';

@Entity('web_search_configs')
export class WebSearchConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: ['duckduckgo', 'brave'], default: 'duckduckgo' })
  provider: WebSearchProvider;

  @Column({ name: 'api_key_enc', type: 'text', nullable: true })
  apiKeyEnc: string | null;

  @Column({ name: 'max_results', type: 'int', default: 5 })
  maxResults: number;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 0 })
  isEnabled: number;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}