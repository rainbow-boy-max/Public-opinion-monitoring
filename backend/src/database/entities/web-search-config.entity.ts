import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export type WebSearchProvider =
  | 'duckduckgo'
  | 'brave'
  | 'baidu_qianfan'
  | 'alibaba_dashscope'
  | 'volcengine_ark'
  | 'deepseek_web'
  | 'boshu_chinese'
  | 'metaso_wenshu'
  | 'tavily';

@Entity('web_search_configs')
export class WebSearchConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 32, default: 'duckduckgo' })
  provider: string;

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