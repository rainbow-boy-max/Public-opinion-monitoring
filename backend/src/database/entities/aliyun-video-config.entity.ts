import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('aliyun_video_configs')
export class AliyunVideoConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'access_key_id', type: 'varchar', length: 255 })
  accessKeyId: string;

  @Column({ name: 'access_key_secret', type: 'varchar', length: 255 })
  accessKeySecret: string;

  @Column({ name: 'region_id', type: 'varchar', length: 64, default: 'cn-hangzhou' })
  regionId: string;

  @Column({ name: 'oss_bucket', type: 'varchar', length: 255, nullable: true })
  ossBucket: string | null;

  @Column({ name: 'oss_endpoint', type: 'varchar', length: 255, nullable: true })
  ossEndpoint: string | null;

  @Column({ name: 'vca_endpoint', type: 'varchar', length: 255, nullable: true, comment: '视频OCR端点' })
  vcaEndpoint: string | null;

  @Column({ name: 'asr_app_key', type: 'varchar', length: 255, nullable: true, comment: '语音识别AppKey' })
  asrAppKey: string | null;

  @Column({ name: 'asr_endpoint', type: 'varchar', length: 255, nullable: true })
  asrEndpoint: string | null;

  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
