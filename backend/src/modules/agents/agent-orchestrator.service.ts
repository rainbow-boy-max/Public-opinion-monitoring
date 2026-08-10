import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { MonitorTaskEntity } from '../../database/entities/monitor-task.entity';

export interface AgentTask {
  id: string;
  type: 'monitor' | 'analyze' | 'report' | 'alert';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface AgentReport {
  summary: string;
  sentiment: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyFindings: string[];
  recommendedActions: string[];
  generatedAt: Date;
}

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private readonly taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  async runOrchestration(taskId: number): Promise<AgentReport> {
    this.logger.log(`Starting multi-agent orchestration for task ${taskId}`);

    const monitorAgent = await this.runMonitorAgent(taskId);
    const analyzeAgent = await this.runAnalyzeAgent(monitorAgent);
    const report = await this.runReportAgent(analyzeAgent);

    this.logger.log(`Orchestration completed for task ${taskId}: risk=${report.riskLevel}`);
    return report;
  }

  private async runMonitorAgent(taskId: number): Promise<OpinionEventEntity[]> {
    this.logger.debug(`[MonitorAgent] Collecting events for task ${taskId}`);
    const events = await this.eventRepo.find({
      where: { taskId },
      order: { matchedAt: 'DESC' },
      take: 50,
    });
    this.logger.debug(`[MonitorAgent] Found ${events.length} events`);
    return events;
  }

  private async runAnalyzeAgent(events: OpinionEventEntity[]): Promise<AnalyzeAgentResult> {
    this.logger.debug(`[AnalyzeAgent] Analyzing ${events.length} events`);

    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const platformCounts = new Map<string, number>();
    let totalReads = 0;
    let totalComments = 0;

    for (const e of events) {
      sentimentCounts[e.sentiment] = (sentimentCounts[e.sentiment] || 0) + 1;
      platformCounts.set(e.platform, (platformCounts.get(e.platform) || 0) + 1);
      totalReads += e.readCount;
      totalComments += e.commentCount;
    }

    const negativeRatio = sentimentCounts.negative / Math.max(events.length, 1);
    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      negativeRatio > 0.5 ? 'critical' :
      negativeRatio > 0.3 ? 'high' :
      negativeRatio > 0.1 ? 'medium' : 'low';

    const topPlatforms = [...platformCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p]) => p);

    return {
      totalEvents: events.length,
      sentimentCounts,
      riskLevel,
      topPlatforms,
      totalReads,
      totalComments,
      negativeRatio,
    };
  }

  private async runReportAgent(analysis: AnalyzeAgentResult): Promise<AgentReport> {
    this.logger.debug('[ReportAgent] Generating report');

    const keyFindings: string[] = [];
    keyFindings.push(`共监测到 ${analysis.totalEvents} 条相关舆情`);
    keyFindings.push(`负面占比 ${(analysis.negativeRatio * 100).toFixed(1)}%`);
    keyFindings.push(`主要传播平台: ${analysis.topPlatforms.join(', ')}`);
    keyFindings.push(`总阅读量 ${analysis.totalReads.toLocaleString()}, 总评论 ${analysis.totalComments.toLocaleString()}`);

    if (analysis.riskLevel === 'high' || analysis.riskLevel === 'critical') {
      keyFindings.push('负面舆情占比过高，建议立即启动应急预案');
    }

    const recommendedActions: string[] = [];
    if (analysis.riskLevel === 'critical') {
      recommendedActions.push('立即启动危机公关预案');
      recommendedActions.push('组织专项舆情研判会议');
      recommendedActions.push('准备官方声明并报上级审批');
    } else if (analysis.riskLevel === 'high') {
      recommendedActions.push('加强监测频次，每 30 分钟输出一次分析简报');
      recommendedActions.push('联系相关平台协调处理高热度负面内容');
    } else if (analysis.riskLevel === 'medium') {
      recommendedActions.push('持续关注，每日输出分析报告');
    } else {
      recommendedActions.push('常规监测，保持每周分析报告');
    }

    return {
      summary: `舆情监测分析报告：共监测 ${analysis.totalEvents} 条事件，风险等级为 ${analysis.riskLevel}。`,
      sentiment: analysis.negativeRatio > 0.3 ? 'negative' : 'neutral',
      riskLevel: analysis.riskLevel,
      keyFindings,
      recommendedActions,
      generatedAt: new Date(),
    };
  }
}

interface AnalyzeAgentResult {
  totalEvents: number;
  sentimentCounts: Record<string, number>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  topPlatforms: string[];
  totalReads: number;
  totalComments: number;
  negativeRatio: number;
}