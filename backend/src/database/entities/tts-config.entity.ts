import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('tts_config')
export class TtsConfigEntity {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'active_provider', type: 'varchar', length: 32, default: 'minimax' })
  activeProvider: string;

  @Column({ name: 'minimax_api_key_enc', type: 'text', nullable: true })
  minimaxApiKeyEnc: string;

  @Column({ name: 'minimax_group_id', type: 'varchar', length: 64, nullable: true })
  minimaxGroupId: string;

  @Column({ name: 'xiaomi_api_key_enc', type: 'text', nullable: true })
  xiaomiApiKeyEnc: string;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
