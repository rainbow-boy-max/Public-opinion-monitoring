import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ShortVideoService } from '../short-video.service';
import { VideoProcessStatus } from '../../../database/entities/short-video.entity';

@Processor('video-ocr')
export class VideoOcrProcessor {
  private readonly logger = new Logger(VideoOcrProcessor.name);

  constructor(private readonly shortVideoService: ShortVideoService) {}

  @Process('extract-frames')
  async handleOcrJob(job: Job<{ videoId: number }>) {
    const { videoId } = job.data;
    this.logger.log(`Starting OCR for video ${videoId}`);

    try {
      await this.shortVideoService.updateProcessStatus(videoId, VideoProcessStatus.OCR_PROCESSING);

      const video = await this.shortVideoService.findOne(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // TODO: 实现视频抽帧逻辑
      // 1. 使用 FFmpeg 或阿里云抽帧 API 提取关键帧
      // 2. 对每一帧调用 OCR API
      // 3. 保存帧记录到 video_frames 表
      // 4. 合并去重文本并更新 short_videos.ocr_text

      this.logger.warn(`OCR implementation pending for video ${videoId}`);
      
      // 临时：标记为完成（实际应在 OCR 完成后）
      // await this.shortVideoService.updateOcrText(videoId, 'OCR text will be extracted here');

      this.logger.log(`OCR completed for video ${videoId}`);
    } catch (error) {
      this.logger.error(`OCR failed for video ${videoId}: ${error.message}`);
      await this.shortVideoService.updateProcessStatus(
        videoId,
        VideoProcessStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }
}
