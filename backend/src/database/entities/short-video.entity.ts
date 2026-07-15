import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('short_videos')
@Index('idx_sv_task_platform', ['taskId', 'platform'])
@Index('idx_sv_matched_at', ['matchedAt'])
export class ShortVideoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @Column({ length: 32 })
  platform: string;

  @Column({ length: 512 })
  title: string;

  @Column({ length: 128 })
  author: string;

  @Column({ name: 'author_avatar', length: 512, nullable: true })
  authorAvatar: string | null;

  @Column({ name: 'video_url', length: 512 })
  videoUrl: string;

  @Column({ name: 'cover_url', length: 512, nullable: true })
  coverUrl: string | null;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'play_count', type: 'int', default: 0 })
  playCount: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({ name: 'share_count', type: 'int', default: 0 })
  shareCount: number;

  @Column({ name: 'collect_count', type: 'int', default: 0 })
  collectCount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  comments: string;

  @Column({ type: 'varchar', length: 16, default: 'neutral' })
  sentiment: string;

  @Column({ type: 'text', nullable: true })
  hashtags: string;

  @Column({ name: 'published_at', type: 'datetime' })
  publishedAt: Date;

  @Column({ name: 'matched_at', type: 'datetime' })
  matchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
