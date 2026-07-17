import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities';
import { KnowledgeGraphService, type GraphNode } from './knowledge-graph.service';
import { AlertRuleService } from '../alert/alert-rule.service';
import { AlertConditionType, AlertLogEntity } from '../../database/entities';

export interface RiskSignal {
  id: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  type: 'sentiment_drop' | 'new_threat' | 'spread_risk' | 'volume_spike';
  entityName: string;
  entityType: string;
  description: string;
  currentScore: number;
  previousScore: number;
  changePercent: number;
  relatedEvents: number;
  suggestedAction: string;
  detectedAt: Date;
}

@Injectable()
export class KgWarningService {
  private readonly logger = new Logger(KgWarningService.name);

  constructor(
    @InjectRepository(OpinionEventEntity) private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(AlertLogEntity) private alertLogRepo: Repository<AlertLogEntity>,
    private kgService: KnowledgeGraphService,
    private alertRuleService: AlertRuleService,
  ) {}

  async checkRiskSignals(userId: number): Promise<RiskSignal[]> {
    try {
      const graph = await this.kgService.extractGraph(userId);
      const signals: RiskSignal[] = [];

      for (const node of graph.nodes) {
        const sentimentDrop = await this.detectSentimentDrop(node);
        if (sentimentDrop) signals.push(sentimentDrop);

        const volumeSpike = await this.detectVolumeSpike(node);
        if (volumeSpike) signals.push(volumeSpike);

        const spreadRisk = await this.detectSpreadRisk(node, graph.edges.filter(e => e.source === node.id || e.target === node.id));
        if (spreadRisk) signals.push(spreadRisk);
      }

      const newThreat = await this.detectNewThreat(graph.nodes);
      if (newThreat) signals.push(newThreat);

      signals.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.level] - order[b.level];
      });

      await this.fireAlertsForCriticalSignals(userId, signals);

      return signals;
    } catch (err) {
      this.logger.warn(`Risk signal detection failed, using mock: ${err}`);
      return this.getMockRiskSignals();
    }
  }

  private async detectSentimentDrop(node: GraphNode): Promise<RiskSignal | null> {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const prevEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = await this.eventRepo.find({
      where: { matchedAt: Between(recentStart, now) },
      take: 50,
      order: { readCount: 'DESC' },
    });

    const prevEvents = await this.eventRepo.find({
      where: { matchedAt: Between(prevStart, prevEnd) },
      take: 50,
      order: { readCount: 'DESC' },
    });

    const entityName = node.name;
    const recentMatches = recentEvents.filter(e =>
      e.title.includes(entityName) || e.content.includes(entityName),
    );
    const prevMatches = prevEvents.filter(e =>
      e.title.includes(entityName) || e.content.includes(entityName),
    );

    if (recentMatches.length < 3) return null;

    const recentAvg = recentMatches.reduce((s, e) => {
      const score = e.sentimentScore ?? 0;
      return s + score;
    }, 0) / recentMatches.length;

    const prevAvg = prevMatches.length > 0
      ? prevMatches.reduce((s, e) => {
          const score = e.sentimentScore ?? 0;
          return s + score;
        }, 0) / prevMatches.length
      : 0;

    if (prevAvg > 0 && recentAvg < -0.2) {
      const changePercent = prevAvg !== 0
        ? ((recentAvg - prevAvg) / Math.abs(prevAvg)) * 100
        : recentAvg * -100;
      const severity = Math.abs(changePercent);
      const level: RiskSignal['level'] = severity > 60 ? 'critical' : severity > 35 ? 'high' : severity > 15 ? 'medium' : 'low';

      return {
        id: `sd-${node.id}-${Date.now()}`,
        level,
        type: 'sentiment_drop',
        entityName: node.name,
        entityType: node.type,
        description: `实体 "${node.name}" 情感分数从 ${prevAvg.toFixed(2)} 骤降至 ${recentAvg.toFixed(2)}`,
        currentScore: recentAvg,
        previousScore: prevAvg,
        changePercent: Math.round(changePercent * 10) / 10,
        relatedEvents: recentMatches.length,
        suggestedAction: `立即关注 "${node.name}" 相关舆情，排查负面原因并启动应对预案`,
        detectedAt: new Date(),
      };
    }

    return null;
  }

  private async detectVolumeSpike(node: GraphNode): Promise<RiskSignal | null> {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const prevStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const prevEnd = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const entityName = node.name;

    const recentEvents = await this.eventRepo.find({
      where: { matchedAt: Between(recentStart, now) },
      take: 200,
    });
    const recentMatchCount = recentEvents.filter(e =>
      e.title.includes(entityName) || e.content.includes(entityName),
    ).length;

    const prevEvents = await this.eventRepo.find({
      where: { matchedAt: Between(prevStart, prevEnd) },
      take: 200,
    });
    const prevMatchCount = prevEvents.filter(e =>
      e.title.includes(entityName) || e.content.includes(entityName),
    ).length;

    if (prevMatchCount > 0 && recentMatchCount > prevMatchCount * 1.5 && recentMatchCount >= 5) {
      const changePercent = ((recentMatchCount - prevMatchCount) / prevMatchCount) * 100;
      const severity = changePercent;
      const level: RiskSignal['level'] = severity > 200 ? 'critical' : severity > 100 ? 'high' : severity > 50 ? 'medium' : 'low';

      return {
        id: `vs-${node.id}-${Date.now()}`,
        level,
        type: 'volume_spike',
        entityName: node.name,
        entityType: node.type,
        description: `实体 "${node.name}" 提及量从 ${prevMatchCount} 增至 ${recentMatchCount}`,
        currentScore: recentMatchCount,
        previousScore: prevMatchCount,
        changePercent: Math.round(changePercent * 10) / 10,
        relatedEvents: recentMatchCount,
        suggestedAction: `监控 "${node.name}" 声量增长趋势，分析增长原因`,
        detectedAt: new Date(),
      };
    }

    return null;
  }

  private async detectSpreadRisk(node: GraphNode, edges: Array<{ source: string; target: string; relation: string; strength: number }>): Promise<RiskSignal | null> {
    if (edges.length >= 5) {
      const now = new Date();
      const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentEvents = await this.eventRepo.find({
        where: { matchedAt: Between(recentStart, now) },
        take: 100,
      });

      const entityName = node.name;
      const matchCount = recentEvents.filter(e =>
        e.title.includes(entityName) || e.content.includes(entityName),
      ).length;

      if (matchCount > 0) {
        const level: RiskSignal['level'] = edges.length >= 10 ? 'critical' : edges.length >= 7 ? 'high' : 'medium';

        return {
          id: `sr-${node.id}-${Date.now()}`,
          level,
          type: 'spread_risk',
          entityName: node.name,
          entityType: node.type,
          description: `实体 "${node.name}" 关联 ${edges.length} 个节点，存在舆情扩散风险`,
          currentScore: edges.length,
          previousScore: 0,
          changePercent: 100,
          relatedEvents: matchCount,
          suggestedAction: `切断 "${node.name}" 的关联传播路径，控制舆情扩散范围`,
          detectedAt: new Date(),
        };
      }
    }

    return null;
  }

  private async detectNewThreat(nodes: GraphNode[]): Promise<RiskSignal | null> {
    const threatKeywords = ['危机', '事故', '违规', '处罚', '诉讼', '召回', '安全', '漏洞'];
    const threatEntities = nodes.filter(n =>
      threatKeywords.some(k => n.name.includes(k)),
    );

    if (threatEntities.length > 0) {
      const entity = threatEntities[0];
      return {
        id: `nt-${entity.id}-${Date.now()}`,
        level: 'high',
        type: 'new_threat',
        entityName: entity.name,
        entityType: entity.type,
        description: `检测到高风险实体 "${entity.name}" 出现`,
        currentScore: 0.8,
        previousScore: 0,
        changePercent: 100,
        relatedEvents: 1,
        suggestedAction: `立即分析 "${entity.name}" 对品牌的影响程度并制定应对策略`,
        detectedAt: new Date(),
      };
    }

    return null;
  }

  private async fireAlertsForCriticalSignals(userId: number, signals: RiskSignal[]): Promise<void> {
    const criticalSignals = signals.filter(s => s.level === 'critical' || s.level === 'high');
    if (criticalSignals.length === 0) return;

    try {
      const rules = await this.alertRuleService.list(userId);
      const matchingRules = rules.filter(r =>
        r.status === 'active' &&
        r.conditionType === AlertConditionType.ENTITY_RISK,
      );

      for (const rule of matchingRules) {
        const config = this.parseConfig(rule.conditionConfig);
        const targetEntityType = config.entityType as string;
        const riskThreshold = (config.riskThreshold as number) ?? 50;

        for (const signal of criticalSignals) {
          if (targetEntityType && signal.entityType !== targetEntityType) continue;
          if ((signal.changePercent) < riskThreshold) continue;

          await this.alertLogRepo.save({
            ruleId: rule.id,
            userId,
            title: `实体风险预警: ${signal.entityName}`,
            message: `${signal.description}。建议操作: ${signal.suggestedAction}`,
            triggerData: JSON.stringify(signal),
            status: 'sent',
          });

          this.logger.log(`Alert fired from KG warning: rule=${rule.id}, entity=${signal.entityName}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to fire alerts for risk signals: ${err}`);
    }
  }

  getMockRiskSignals(): RiskSignal[] {
    return [
      {
        id: 'sd-huawei-1',
        level: 'critical',
        type: 'sentiment_drop',
        entityName: '华为',
        entityType: 'org',
        description: '实体 "华为" 情感分数从 0.65 骤降至 -0.42',
        currentScore: -0.42,
        previousScore: 0.65,
        changePercent: -164.6,
        relatedEvents: 23,
        suggestedAction: '立即关注 "华为" 相关舆情，排查负面原因并启动应对预案',
        detectedAt: new Date(),
      },
      {
        id: 'vs-xiaomi-2',
        level: 'high',
        type: 'volume_spike',
        entityName: '小米SU7',
        entityType: 'product',
        description: '实体 "小米SU7" 提及量从 12 增至 45',
        currentScore: 45,
        previousScore: 12,
        changePercent: 275,
        relatedEvents: 45,
        suggestedAction: '监控 "小米SU7" 声量增长趋势，分析增长原因',
        detectedAt: new Date(),
      },
      {
        id: 'sr-apple-3',
        level: 'medium',
        type: 'spread_risk',
        entityName: '苹果',
        entityType: 'org',
        description: '实体 "苹果" 关联 8 个节点，存在舆情扩散风险',
        currentScore: 8,
        previousScore: 0,
        changePercent: 100,
        relatedEvents: 15,
        suggestedAction: '切断 "苹果" 的关联传播路径，控制舆情扩散范围',
        detectedAt: new Date(),
      },
      {
        id: 'nt-chip-4',
        level: 'high',
        type: 'new_threat',
        entityName: '芯片制裁',
        entityType: 'event',
        description: '检测到高风险实体 "芯片制裁" 出现',
        currentScore: 0.8,
        previousScore: 0,
        changePercent: 100,
        relatedEvents: 1,
        suggestedAction: '立即分析 "芯片制裁" 对品牌的影响程度并制定应对策略',
        detectedAt: new Date(),
      },
      {
        id: 'vs-catl-5',
        level: 'low',
        type: 'volume_spike',
        entityName: '宁德时代',
        entityType: 'org',
        description: '实体 "宁德时代" 提及量从 5 增至 11',
        currentScore: 11,
        previousScore: 5,
        changePercent: 120,
        relatedEvents: 11,
        suggestedAction: '监控 "宁德时代" 声量增长趋势，分析增长原因',
        detectedAt: new Date(),
      },
    ];
  }

  private parseConfig(json: string): Record<string, unknown> {
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
