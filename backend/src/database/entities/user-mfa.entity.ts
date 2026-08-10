import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('user_mfa')
@Unique(['userId'])
export class UserMfaEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'secret_key', length: 256 })
  secretKey: string;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 0 })
  isEnabled: boolean;

  @Column({ name: 'backup_codes', type: 'text', nullable: true })
  backupCodes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
