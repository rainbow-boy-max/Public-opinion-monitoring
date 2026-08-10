import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('captcha_configs')
export class CaptchaConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 0 })
  isEnabled: boolean;

  @Column({ name: 'region', length: 32, default: 'cn' })
  region: string;

  @Column({ name: 'prefix', length: 128, nullable: true })
  prefix: string | null;

  @Column({ name: 'scene_id', length: 128, nullable: true })
  sceneId: string | null;

  @Column({ name: 'access_key_id', length: 256, nullable: true })
  accessKeyId: string | null;

  @Column({ name: 'access_key_secret', length: 512, nullable: true })
  accessKeySecret: string | null;

  @Column({ name: 'endpoint', length: 256, default: 'captcha.cn-shanghai.aliyuncs.com' })
  endpoint: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}