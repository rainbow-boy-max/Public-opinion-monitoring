import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AttributionAnalysisEntity, TriggerEvent, KeyNode, PropagationEdge } from '../../database/entities/attribution-analysis.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { LlmService } from '../agents/llm.service';

@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name);

  constructor(
    @InjectRepository(AttributionAnalysisEntity)
    private readonly attributionRepo: Repository<AttributionAnalysisEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
    private readonly llmService: LlmService,
  ) {}

  async createAnalysis(eventId: number): Promise<AttributionAnalysisEntity> {
    const startTime = Date.now();
    
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('事件不存在');
    }

    const triggerEvents = await this.findTriggerEvents(event);
    const keyNodes = await this.identifyKeyNodes(event, triggerEvents);
    const propagationPath = this.buildPropagationPath(triggerEvents);
    const analysisContent = await this.generateAnalysisReport(event, triggerEvents, keyNodes);
    
    const duration = Date.now() - startTime;
    
    const analysis = this.attributionRepo.create({
      eventId,
      triggerEvents,
      keyNodes,
      propagationPath,
      analysisContent,
      llmGenerated: true,
      analysisDurationMs: duration,
    });
    
    await this.attributionRepo.save(analysis);
    
    this.logger.log(`Created attribution analysis for event ${eventId} in ${duration}ms`);
    
    return analysis;
  }

  private async findTriggerEvents(event: OpinionEventEntity): Promise<TriggerEvent[]> {
    const windowStart = new Date(event.publishTime.getTime() - 24 * 3600000);
    
    const relatedEvents = await this.eventRepo.find({
      where: {
        taskId: event.taskId,
        publishTime: LessThan(event.publishTime),
      },
      order: {
        publishTime: 'DESC',
      },
      take: 10,
    });
    
    return relatedEvents
      .filter(e => e.publishTime >= windowStart)
      .map(e => ({
        eventId: e.id,
        title: e.title,
        time: e.publishTime,
        impact: this.calculateImpact(e),
      }))
      .sort((a, b) => b.impact - a.impact);
  }

  private calculateImpact(event: OpinionEventEntity): number {
    return event.readCount * 0.1 + event.likeCount * 0.3 + event.commentCount * 0.5 + event.shareCount * 0.7;
  }

  private async identifyKeyNodes(event: OpinionEventEntity, triggerEvents: TriggerEvent[]): Promise<KeyNode[]> {
    const nodes: KeyNode[] = [];
    
    nodes.push({
      type: this.determineNodeType(event.author),
      name: event.author,
      followersCount: 0,
      propagationPower: this.calculateImpact(event),
    });
    
    for (const trigger of triggerEvents.slice(0, 5)) {
      const triggerEvent = await this.eventRepo.findOne({ where: { id: trigger.eventId } });
      if (triggerEvent) {
        nodes.push({
          type: this.determineNodeType(triggerEvent.author),
          name: triggerEvent.author,
          followersCount: 0,
          propagationPower: trigger.impact,
        });
      }
    }
    
    return nodes;
  }

  private determineNodeType(author: string): 'kol' | 'media' | 'official' {
    if (author.includes('官方') || author.includes('机构')) return 'official';
    if (author.includes('媒体') || author.includes('新闻')) return 'media';
    return 'kol';
  }

  private buildPropagationPath(triggerEvents: TriggerEvent[]): PropagationEdge[] {
    const edges: PropagationEdge[] = [];
    
    for (let i = 0; i < triggerEvents.length - 1; i++) {
      edges.push({
        source: `Event_${triggerEvents[i].eventId}`,
        target: `Event_${triggerEvents[i + 1].eventId}`,
        weight: triggerEvents[i].impact / 1000,
      });
    }
    
    return edges;
  }

  private async generateAnalysisReport(
    event: OpinionEventEntity,
    triggerEvents: TriggerEvent[],
    keyNodes: KeyNode[]
  ): Promise<string> {
    const prompt = `请分析以下舆情事件的归因：

主事件：
标题：${event.title}
内容：${event.content.substring(0, 500)}
发布时间：${event.publishTime.toISOString()}

触发事件（${triggerEvents.length} 个）：
${triggerEvents.map((t, i) => `${i + 1}. ${t.title}（影响力：${t.impact.toFixed(0)}）`).join('\n')}

关键节点（${keyNodes.length} 个）：
${keyNodes.map((n, i) => `${i + 1}. ${n.name}（类型：${n.type}）`).join('\n')}

请生成 500-800 字的归因分析报告。`;

    try {
      const response = await this.llmService.chat({
        baseUrl: process.env.LLM_BASE_URL || '',
        apiKey: process.env.LLM_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      
      return response.content;
    } catch (error) {
      this.logger.error(`LLM generation failed: ${error.message}`);
      return this.generateFallbackReport(event, triggerEvents, keyNodes);
    }
  }

  private generateFallbackReport(
    event: OpinionEventEntity,
    triggerEvents: TriggerEvent[],
    keyNodes: KeyNode[]
  ): string {
    return `## 归因分析报告

### 舆情概况
事件「${event.title}」引发了较大关注。

### 触发事件
在该事件爆发前 24 小时内，共发现 ${triggerEvents.length} 个相关事件。

### 关键节点
参与传播的关键节点包括 ${keyNodes.length} 个。

### 分析结论
该舆情事件的爆发是多因素综合作用的结果，需要持续关注后续发展。

（注：本报告为自动生成的备用版本）`;
  }

  async getAnalysis(eventId: number): Promise<AttributionAnalysisEntity | null> {
    return this.attributionRepo.findOne({
      where: { eventId },
      order: { createdAt: 'DESC' },
      relations: ['event'],
    });
  }
}
