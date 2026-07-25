import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ShortVideoEntity } from './short-video.entity';

@Entity('video_transcripts')
export class VideoTranscriptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'video_id', type: 'bigint' })
  videoId: number;

  @ManyToOne(() => ShortVideoEntity)
  @JoinColumn({ name: 'video_id' })
  video: ShortVideoEntity;

  @Column({ name: 'start_time', type: 'float', comment: '语音片段开始时间（秒）' })
  startTime: number;

  @Column({ name: 'end_time', type: 'float', comment: '语音片段结束时间（秒）' })
  endTime: number;

  @Column({ type: 'text', comment: 'ASR 识别文本' })
  text: string;

  @Column({ type: 'float', nullable: true, comment: 'ASR 识别置信度' })
  confidence: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: '说话人标识' })
  speaker: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
