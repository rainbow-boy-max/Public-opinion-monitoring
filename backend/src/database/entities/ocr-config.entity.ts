import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('ocr_config')
export class OcrConfigEntity {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ type: 'int', nullable: true })
  primaryModelId: number;

  @Column({ type: 'json', nullable: true })
  backupModelIds: number[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
