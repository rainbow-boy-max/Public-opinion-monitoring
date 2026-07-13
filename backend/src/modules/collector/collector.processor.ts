import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { CollectorService } from './collector.service';

@Processor('task-queue')
export class CollectorProcessor {
  private readonly logger = new Logger(CollectorProcessor.name);

  constructor(private collectorService: CollectorService) {}

  @Process('collect')
  async handleCollect(job: Job): Promise<void> {
    this.logger.debug(`Processing collect job ${job.id}`);
    await this.collectorService.processJob(job);
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.warn(`Job ${job.id} failed: ${err.message}`);
  }
}
