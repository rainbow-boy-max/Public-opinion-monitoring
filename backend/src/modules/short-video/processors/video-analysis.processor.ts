import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ShortVideoService } from '../short-video.service';
import { MultimodalAnalysisService } from '../multimodal-analysis.service';
import { VideoProcessStatus } from '../../../database/entities/short-video.entity';

@Processor('video-analysis')
export class VideoAnalysisProcessor {
  private readonly logger = new Logger(VideoAnalysisProcessor.name);

  constructor(
    private readonly shortVideoService: ShortVideoService,
    private readonly multimodal: MultimodalAnalysisService,
  ) {}

  @Process('analyze-content')
  async handleAnalysisJob(job: Job<{ videoId: number }>) {
    const { videoId } = job.data;
    this.logger.log(`Starting semantic analysis for video ${videoId}`);

    try {
      await this.shortVideoService.updateProcessStatus(videoId, VideoProcessStatus.ANALYZING);

      const result = await this.multimodal.analyzeContent(videoId);

      this.logger.log(
        `Semantic analysis completed for video ${videoId}: ` +
        `sentiment=${result.sentiment}, tags=[${result.tags.join(', ')}]`,
      );
    } catch (error) {
      this.logger.error(`Semantic analysis failed for video ${videoId}: ${(error as Error).message}`);
      await this.shortVideoService.updateProcessStatus(
        videoId,
        VideoProcessStatus.FAILED,
        (error as Error).message,
      );
      throw error;
    }
  }
}
