import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ShortVideoService } from '../short-video.service';
import { MultimodalAnalysisService } from '../multimodal-analysis.service';
import { VideoProcessStatus } from '../../../database/entities/short-video.entity';

@Processor('video-ocr')
export class VideoOcrProcessor {
  private readonly logger = new Logger(VideoOcrProcessor.name);

  constructor(
    private readonly shortVideoService: ShortVideoService,
    private readonly multimodal: MultimodalAnalysisService,
  ) {}

  @Process('extract-frames')
  async handleOcrJob(job: Job<{ videoId: number }>) {
    const { videoId } = job.data;
    this.logger.log(`Starting OCR for video ${videoId}`);

    try {
      await this.shortVideoService.updateProcessStatus(videoId, VideoProcessStatus.OCR_PROCESSING);

      const ocrText = await this.multimodal.runOcrOnFrames(videoId);

      await this.shortVideoService.updateOcrText(videoId, ocrText);

      this.logger.log(`OCR completed for video ${videoId}: ${ocrText.length} chars`);
    } catch (error) {
      this.logger.error(`OCR failed for video ${videoId}: ${(error as Error).message}`);
      await this.shortVideoService.updateProcessStatus(
        videoId,
        VideoProcessStatus.FAILED,
        (error as Error).message,
      );
      throw error;
    }
  }
}
