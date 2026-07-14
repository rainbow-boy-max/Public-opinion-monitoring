import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { KnowledgeBasesService } from './knowledge-bases.service';

interface KnowledgeJobData {
  kbId: number;
  fileId: number;
  filePath: string;
  fileType: string;
}

@Processor('knowledge-parse')
export class KnowledgeProcessor {
  private readonly logger = new Logger(KnowledgeProcessor.name);

  constructor(private service: KnowledgeBasesService) {}

  @Process('parse')
  async parse(job: Job<KnowledgeJobData>): Promise<void> {
    const { kbId, fileId, filePath, fileType } = job.data;
    this.logger.log(`开始解析知识库文件 job=${job.id} kb=${kbId} file=${fileId}`);
    await this.service.parseAndStore(kbId, fileId, filePath, fileType);
    await this.service.aiAutoClassify(kbId);
  }
}
