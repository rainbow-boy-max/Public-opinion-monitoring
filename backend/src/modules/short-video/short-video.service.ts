import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ShortVideoEntity, VideoProcessStatus } from '../../database/entities/short-video.entity';
import { VideoFrameEntity } from '../../database/entities/video-frame.entity';
import { VideoTranscriptEntity } from '../../database/entities/video-transcript.entity';

@Injectable()
export class ShortVideoService {
  private readonly logger = new Logger(ShortVideoService.name);

  constructor(
    @InjectRepository(ShortVideoEntity)
    private readonly videoRepo: Repository<ShortVideoEntity>,
    @InjectRepository(VideoFrameEntity)
    private readonly frameRepo: Repository<VideoFrameEntity>,
    @InjectRepository(VideoTranscriptEntity)
    private readonly transcriptRepo: Repository<VideoTranscriptEntity>,
    @InjectQueue('video-ocr') private readonly ocrQueue: Queue,
    @InjectQueue('video-asr') private readonly asrQueue: Queue,
    @InjectQueue('video-analysis') private readonly analysisQueue: Queue,
  ) {}

  async createVideo(data: Partial<ShortVideoEntity>): Promise<ShortVideoEntity> {
    const video = this.videoRepo.create(data);
    await this.videoRepo.save(video);
    this.logger.log(`Created video: ${video.id} from ${video.platform}`);

    // 触发 OCR 和 ASR 队列任务
    await this.ocrQueue.add('extract-frames', { videoId: video.id });
    await this.asrQueue.add('transcribe-audio', { videoId: video.id });

    return video;
  }

  async findAll(params: {
    platform?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: ShortVideoEntity[]; total: number }> {
    const { platform, keyword, page = 1, pageSize = 20 } = params;
    const query = this.videoRepo.createQueryBuilder('video');

    if (platform) {
      query.andWhere('video.platform = :platform', { platform });
    }

    if (keyword) {
      query.andWhere(
        '(video.title LIKE :keyword OR video.description LIKE :keyword OR video.ocrText LIKE :keyword OR video.asrText LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    query.orderBy('video.publishTime', 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async findOne(id: number): Promise<ShortVideoEntity | null> {
    return this.videoRepo.findOne({
      where: { id },
      relations: ['relatedEvent'],
    });
  }

  async updateProcessStatus(
    id: number,
    status: VideoProcessStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.videoRepo.update(id, {
      processStatus: status,
      errorMessage: errorMessage || null,
    });
  }

  async updateOcrText(id: number, ocrText: string): Promise<void> {
    await this.videoRepo.update(id, { ocrText });
    this.logger.log(`Updated OCR text for video ${id}`);
  }

  async updateAsrText(id: number, asrText: string): Promise<void> {
    await this.videoRepo.update(id, { asrText });
    this.logger.log(`Updated ASR text for video ${id}`);
  }

  async updateSemanticAnalysis(
    id: number,
    data: {
      semanticSummary?: string;
      sentiment?: string;
      tags?: string[];
      relatedEventId?: number;
    },
  ): Promise<void> {
    await this.videoRepo.update(id, data);
    this.logger.log(`Updated semantic analysis for video ${id}`);
  }

  async saveFrame(frame: Partial<VideoFrameEntity>): Promise<VideoFrameEntity> {
    return this.frameRepo.save(frame);
  }

  async saveTranscript(transcript: Partial<VideoTranscriptEntity>): Promise<VideoTranscriptEntity> {
    return this.transcriptRepo.save(transcript);
  }

  async getFrames(videoId: number): Promise<VideoFrameEntity[]> {
    return this.frameRepo.find({
      where: { videoId },
      order: { frameIndex: 'ASC' },
    });
  }

  async getTranscripts(videoId: number): Promise<VideoTranscriptEntity[]> {
    return this.transcriptRepo.find({
      where: { videoId },
      order: { startTime: 'ASC' },
    });
  }
}
