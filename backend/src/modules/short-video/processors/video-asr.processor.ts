import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ShortVideoService } from '../short-video.service';
import { VideoProcessStatus } from '../../../database/entities/short-video.entity';

@Processor('video-asr')
export class VideoAsrProcessor {
  private readonly logger = new Logger(VideoAsrProcessor.name);

  constructor(private readonly shortVideoService: ShortVideoService) {}

  @Process('transcribe-audio')
  async handleAsrJob(job: Job<{ videoId: number }>) {
    const { videoId } = job.data;
    this.logger.log(`Starting ASR for video ${videoId}`);

    try {
      await this.shortVideoService.updateProcessStatus(videoId, VideoProcessStatus.ASR_PROCESSING);

      const video = await this.shortVideoService.findOne(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // TODO: 实现语音识别逻辑
      // 1. 使用 FFmpeg 提取音频
      // 2. 调用 ASR API（阿里云/腾讯云）
      // 3. 保存转录记录到 video_transcripts 表
      // 4. 合并完整文本并更新 short_videos.asr_text

      this.logger.warn(`ASR implementation pending for video ${videoId}`);
      
      // 临时：标记为完成（实际应在 ASR 完成后）
      // await this.shortVideoService.updateAsrText(videoId, 'ASR text will be extracted here');

      this.logger.log(`ASR completed for video ${videoId}`);
    } catch (error) {
      this.logger.error(`ASR failed for video ${videoId}: ${error.message}`);
      await this.shortVideoService.updateProcessStatus(
        videoId,
        VideoProcessStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }
}
