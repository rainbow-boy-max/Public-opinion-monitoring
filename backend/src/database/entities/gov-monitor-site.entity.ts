import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MonitorSiteType = 'self' | 'superior' | 'peer' | 'policy';
export type MonitorSiteStatus = 'active' | 'paused';

@Entity('gov_monitor_sites')
export class GovMonitorSiteEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'site_name', type: 'varchar', length: 255 })
  siteName: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ name: 'site_type', type: 'varchar', length: 32, default: 'self' })
  siteType: MonitorSiteType;

  @Column({ name: 'css_selector', type: 'varchar', length: 500, nullable: true })
  cssSelector: string | null;

  @Column({ name: 'check_frequency', type: 'int', default: 60 })
  checkFrequency: number;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: MonitorSiteStatus;

  @Column({ name: 'last_checked_at', type: 'datetime', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ name: 'last_content_hash', type: 'varchar', length: 64, nullable: true })
  lastContentHash: string | null;

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('gov_monitor_changes')
export class GovMonitorChangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'site_id', type: 'bigint' })
  siteId: number;

  @Column({ name: 'change_type', type: 'varchar', length: 32 })
  changeType: 'new' | 'updated' | 'removed';

  @Column({ name: 'title', type: 'varchar', length: 500 })
  title: string;

  @Column({ name: 'link_url', type: 'varchar', length: 512, nullable: true })
  linkUrl: string | null;

  @Column({ type: 'text', nullable: true })
  snippet: string | null;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;

  @Column({ name: 'detected_at', type: 'datetime' })
  detectedAt: Date;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
