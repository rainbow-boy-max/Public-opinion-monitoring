import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('feature_flags')
export class FeatureFlagEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  key: string;

  @Column({ length: 128 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 1 })
  isEnabled: boolean;

  @Column({ name: 'menu_path', length: 128, nullable: true })
  menuPath: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'category', length: 64, nullable: true })
  category: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}