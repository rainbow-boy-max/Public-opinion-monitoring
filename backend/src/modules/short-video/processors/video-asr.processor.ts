import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ShortVideoService } from '../short-video.service';
import { MultimodalAnalysisService } from '../multimodal-analysis.service';
import { VideoProcessStatus } from '../../../database/entities/short-video.entity';

@Processor('video-asr')
export class VideoAsrProcessor {
  private readonly logger = new Logger(VideoAsrProcessor.name);

  constructor(
    private readonly shortVideoService: ShortVideoService,
    private readonly multimodal: MultimodalAnalysisService,
  ) {}

  @Process('transcribe-audio')
  async handleAsrJob(job: Job<{ videoId: number }>) {
    const { videoId } = job.data;
    this.logger.log(`Starting ASR for video ${videoId}`);

    try {
      await this.shortVideoService.updateProcessStatus(videoId, VideoProcessStatus.ASR_PROCESSING);

      const asrText = await this.multimodal.transcribeAudio(videoId);

      await this.shortVideoService.updateAsrText(videoId, asrText);

      this.logger.log(`ASR completed for video ${videoId}: ${asrText.length} chars`);
    } catch (error) {
      this.logger.error(`ASR failed for video ${videoId}: ${(error as Error).message}`);
      await this.shortVideoService.updateProcessStatus(
        videoId,
        VideoProcessStatus.FAILED,
        (error as Error).message,
      );
      throw error;
    }
  }
}
