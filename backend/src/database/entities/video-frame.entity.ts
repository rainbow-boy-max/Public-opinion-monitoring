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

@Entity('video_frames')
export class VideoFrameEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'video_id', type: 'bigint' })
  videoId: number;

  @ManyToOne(() => ShortVideoEntity)
  @JoinColumn({ name: 'video_id' })
  video: ShortVideoEntity;

  @Column({ name: 'frame_index', type: 'int', comment: '帧序号（第几帧）' })
  frameIndex: number;

  @Column({ name: 'timestamp', type: 'float', comment: '视频时间戳（秒）' })
  timestamp: number;

  @Column({ name: 'frame_url', type: 'text', comment: '抽帧图片 URL' })
  frameUrl: string;

  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText: string | null;

  @Column({ name: 'ocr_confidence', type: 'float', nullable: true, comment: 'OCR 识别置信度' })
  ocrConfidence: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
