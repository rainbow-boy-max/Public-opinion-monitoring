import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AgentKbService } from './agent-kb.service';

interface KbJobData {
  agentId: number;
  fileId: number;
  filePath: string;
  fileType: string;
}

@Processor('agent-kb')
export class AgentKbProcessor {
  private readonly logger = new Logger(AgentKbProcessor.name);

  constructor(private service: AgentKbService) {}

  @Process('parse')
  async parse(job: Job<KbJobData>): Promise<void> {
    const { agentId, fileId, filePath, fileType } = job.data;
    this.logger.log(`开始解析知识库文件 job=${job.id} agent=${agentId} file=${fileId}`);
    await this.service.parseAndStore(agentId, fileId, filePath, fileType);
  }
}
