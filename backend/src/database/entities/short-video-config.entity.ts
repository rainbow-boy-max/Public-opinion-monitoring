import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PlatformType {
  DOUYIN = 'douyin',
  KUAISHOU = 'kuaishou',
  WEIXIN_CHANNELS = 'weixin_channels',
  BILIBILI = 'bilibili',
}

@Entity('short_video_configs')
export class ShortVideoConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  platform: PlatformType;

  @Column({ name: 'app_key', type: 'varchar', length: 255, nullable: true })
  appKey: string | null;

  @Column({ name: 'app_secret', type: 'varchar', length: 255, nullable: true })
  appSecret: string | null;

  @Column({ name: 'api_base_url', type: 'varchar', length: 255, nullable: true })
  apiBaseUrl: string | null;

  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'text', nullable: true, comment: '平台特有配置 JSON' })
  extraConfig: string | null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
