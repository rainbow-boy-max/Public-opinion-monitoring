import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('propagation_links')
export class PropagationLinkEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'source_event_id', type: 'bigint' })
  @Index()
  sourceEventId: number;

  @Column({ name: 'target_event_id', type: 'bigint' })
  @Index()
  targetEventId: number;

  @Column({ name: 'source_platform', length: 32 })
  sourcePlatform: string;

  @Column({ name: 'target_platform', length: 32 })
  targetPlatform: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  similarity: number;

  @Column({ name: 'relation_type', length: 32, default: 'repost' })
  relationType: 'repost' | 'quote' | 'similar';

  @Column({ name: 'detected_at', type: 'datetime' })
  detectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
