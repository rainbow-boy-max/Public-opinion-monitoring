import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MonitorTaskEntity } from './monitor-task.entity';

export type PlatformType =
  | 'weixin'
  | 'weixin_video'
  | 'douyin'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'weibo'
  | 'baijiahao';

export type Sentiment = 'positive' | 'negative' | 'neutral';

@Entity('opinion_events')
@Index('idx_task_time', ['taskId', 'matchedAt'])
@Index('idx_publish_time', ['publishTime'])
export class OpinionEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'task_id', type: 'bigint' })
  taskId: number;

  @ManyToOne(() => MonitorTaskEntity)
  @JoinColumn({ name: 'task_id' })
  task: MonitorTaskEntity;

  @Column({ length: 32 })
  platform: string;

  @Column({ length: 512 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ length: 128 })
  author: string;

  @Column({ name: 'author_avatar', length: 512, nullable: true })
  authorAvatar: string | null;

  @Column({ name: 'publish_time', type: 'datetime' })
  publishTime: Date;

  @Column({ length: 512 })
  url: string;

  @Column({ name: 'read_count', type: 'int', default: 0 })
  readCount: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({ name: 'share_count', type: 'int', default: 0 })
  shareCount: number;

  @Column({
    type: 'varchar', length: 32,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral',
  })
  sentiment: Sentiment;

  @Column({ name: 'matched_keywords', type: 'json' })
  matchedKeywords: string[];

  @Column({ name: 'raw_data', type: 'json' })
  rawData: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  status: number;

  @Column({ name: 'matched_at', type: 'datetime' })
  matchedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}