import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OpinionEventEntity } from './opinion-event.entity';

export enum VideoPlatform {
  DOUYIN = 'douyin',
  KUAISHOU = 'kuaishou',
  WEIXIN_CHANNELS = 'weixin_channels',
  BILIBILI = 'bilibili',
}

export enum VideoProcessStatus {
  PENDING = 'pending',
  OCR_PROCESSING = 'ocr_processing',
  ASR_PROCESSING = 'asr_processing',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('short_videos')
export class ShortVideoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'platform', type: 'varchar', length: 32 })
  platform: VideoPlatform;

  @Index()
  @Column({ name: 'platform_video_id', type: 'varchar', length: 128 })
  platformVideoId: string;

  @Column({ name: 'video_url', type: 'text' })
  videoUrl: string;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'author_id', type: 'varchar', length: 128 })
  authorId: string;

  @Column({ name: 'author_name', type: 'varchar', length: 255 })
  authorName: string;

  @Column({ name: 'author_avatar', type: 'text', nullable: true })
  authorAvatar: string | null;

  @Column({ name: 'publish_time', type: 'datetime', nullable: true })
  publishTime: Date | null;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({ name: 'share_count', type: 'int', default: 0 })
  shareCount: number;

  @Column({ name: 'play_count', type: 'int', default: 0 })
  playCount: number;

  @Column({ name: 'duration', type: 'int', nullable: true, comment: '视频时长（秒）' })
  duration: number | null;

  @Column({ name: 'process_status', type: 'varchar', length: 32, default: VideoProcessStatus.PENDING })
  processStatus: VideoProcessStatus;

  @Column({ name: 'ocr_text', type: 'text', nullable: true, comment: '视频画面 OCR 提取文本' })
  ocrText: string | null;

  @Column({ name: 'asr_text', type: 'text', nullable: true, comment: '视频语音识别文本' })
  asrText: string | null;

  @Column({ name: 'semantic_summary', type: 'text', nullable: true, comment: 'LLM 生成的语义摘要' })
  semanticSummary: string | null;

  @Column({ name: 'sentiment', type: 'varchar', length: 32, nullable: true })
  sentiment: string | null;

  @Column({ name: 'tags', type: 'json', nullable: true, comment: '视频标签数组' })
  tags: string[] | null;

  @Column({ name: 'related_event_id', type: 'bigint', nullable: true })
  relatedEventId: number | null;

  @ManyToOne(() => OpinionEventEntity, { nullable: true })
  @JoinColumn({ name: 'related_event_id' })
  relatedEvent: OpinionEventEntity | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
