# Phase 9 服务层实施指南

## 趋势预测服务完整实现

### 1. 趋势预测模块

```typescript
// backend/src/modules/prediction/prediction.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrendPredictionEntity } from '../../database/entities/trend-prediction.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrendPredictionEntity,
      OpinionEventEntity,
    ]),
  ],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
```

### 2. 趋势预测服务

```typescript
// backend/src/modules/prediction/prediction.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TrendPredictionEntity, RiskLevel, PredictedDataPoint } from '../../database/entities/trend-prediction.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';

interface HistoricalDataPoint {
  time: Date;
  heat: number;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    @InjectRepository(TrendPredictionEntity)
    private readonly predictionRepo: Repository<TrendPredictionEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  /**
   * 创建趋势预测
   */
  async createPrediction(eventId: number, horizon: number): Promise<TrendPredictionEntity> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('事件不存在');
    }

    // 采集历史数据
    const historicalData = await this.collectHistoricalData(eventId);
    
    if (historicalData.length < 7) {
      throw new Error('历史数据不足，至少需要 7 个数据点');
    }

    // 预测未来热度
    const predictedHeat = this.predictByMovingAverage(historicalData, horizon);
    
    // 检测异常
    const anomalyDetected = this.detectAnomaly(
      event.readCount + event.likeCount + event.commentCount,
      historicalData.map(d => d.heat)
    );
    
    // 评估风险
    const riskLevel = this.assessRisk(
      predictedHeat.map(p => p.value),
      event.readCount + event.likeCount + event.commentCount
    );
    
    // 计算置信度
    const confidenceScore = this.calculateConfidence(historicalData);
    
    // 保存预测结果
    const prediction = this.predictionRepo.create({
      eventId,
      predictionHorizon: horizon,
      predictedHeat,
      riskLevel,
      confidenceScore,
      anomalyDetected,
      algorithmUsed: 'moving_average',
      historicalDataPoints: historicalData.length,
    });
    
    await this.predictionRepo.save(prediction);
    
    this.logger.log(`Created prediction for event ${eventId}, risk: ${riskLevel}`);
    
    return prediction;
  }

  /**
   * 采集历史数据
   * 目前简化实现：基于事件的互动数据
   * 生产环境应从时间序列表或监控日志中采集
   */
  private async collectHistoricalData(eventId: number): Promise<HistoricalDataPoint[]> {
    // 简化实现：获取最近 7 天的相关事件数据
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return [];
    
    // 查找相同任务下的相关事件
    const relatedEvents = await this.eventRepo.find({
      where: {
        taskId: event.taskId,
        publishTime: Between(sevenDaysAgo, new Date()),
      },
      order: {
        publishTime: 'ASC',
      },
      take: 100,
    });
    
    // 构建历史数据点（按天聚合）
    const dataByDay = new Map<string, number>();
    
    for (const evt of relatedEvents) {
      const day = evt.publishTime.toISOString().split('T')[0];
      const heat = evt.readCount + evt.likeCount + evt.commentCount;
      dataByDay.set(day, (dataByDay.get(day) || 0) + heat);
    }
    
    return Array.from(dataByDay.entries()).map(([day, heat]) => ({
      time: new Date(day),
      heat,
    }));
  }

  /**
   * 移动平均预测算法
   */
  private predictByMovingAverage(
    historicalData: HistoricalDataPoint[],
    horizon: number
  ): PredictedDataPoint[] {
    const predictions: PredictedDataPoint[] = [];
    
    // 计算平均增长率
    const growthRates: number[] = [];
    for (let i = 1; i < historicalData.length; i++) {
      if (historicalData[i - 1].heat === 0) continue;
      const rate = (historicalData[i].heat - historicalData[i - 1].heat) / historicalData[i - 1].heat;
      growthRates.push(rate);
    }
    
    const avgGrowthRate = growthRates.length > 0
      ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
      : 0;
    
    // 预测未来数据点
    let lastValue = historicalData[historicalData.length - 1].heat;
    const lastTime = historicalData[historicalData.length - 1].time;
    
    for (let h = 1; h <= horizon; h++) {
      const predictedValue = Math.max(0, lastValue * (1 + avgGrowthRate));
      predictions.push({
        timestamp: new Date(lastTime.getTime() + h * 3600000),
        value: Math.round(predictedValue),
      });
      lastValue = predictedValue;
    }
    
    return predictions;
  }

  /**
   * 异常检测（3σ 原则）
   */
  private detectAnomaly(currentValue: number, historicalValues: number[]): boolean {
    if (historicalValues.length < 3) return false;
    
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues
      .map(x => Math.pow(x - mean, 2))
      .reduce((a, b) => a + b, 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    // 3σ 原则：超过 3 倍标准差视为异常
    return Math.abs(currentValue - mean) > 3 * stdDev;
  }

  /**
   * 风险评级
   */
  private assessRisk(predictedHeat: number[], currentHeat: number): RiskLevel {
    if (predictedHeat.length === 0) return 'low';
    
    const maxPredicted = Math.max(...predictedHeat);
    if (currentHeat === 0) return 'low';
    
    const growthRate = (maxPredicted - currentHeat) / currentHeat;
    
    if (growthRate > 2) return 'critical'; // 增长超过 200%
    if (growthRate > 1) return 'high';     // 增长超过 100%
    if (growthRate > 0.5) return 'medium'; // 增长超过 50%
    return 'low';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(historicalData: HistoricalDataPoint[]): number {
    // 基于数据点数量和波动性计算置信度
    const dataPoints = historicalData.length;
    
    // 数据点越多，置信度越高
    let baseConfidence = Math.min(dataPoints / 14, 1) * 50; // 最多 50 分
    
    // 波动性越小，置信度越高
    const values = historicalData.map(d => d.heat);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length;
    const cv = mean === 0 ? 1 : Math.sqrt(variance) / mean; // 变异系数
    
    const stabilityScore = Math.max(0, 50 - cv * 25); // 最多 50 分
    
    return Math.round(baseConfidence + stabilityScore);
  }

  /**
   * 获取预测结果
   */
  async getPrediction(eventId: number): Promise<TrendPredictionEntity | null> {
    return this.predictionRepo.findOne({
      where: { eventId },
      order: { createdAt: 'DESC' },
      relations: ['event'],
    });
  }

  /**
   * 获取预测列表
   */
  async listPredictions(params: {
    page?: number;
    pageSize?: number;
    riskLevel?: RiskLevel;
  }): Promise<{ data: TrendPredictionEntity[]; total: number }> {
    const { page = 1, pageSize = 20, riskLevel } = params;
    
    const query = this.predictionRepo.createQueryBuilder('prediction')
      .leftJoinAndSelect('prediction.event', 'event');
    
    if (riskLevel) {
      query.andWhere('prediction.riskLevel = :riskLevel', { riskLevel });
    }
    
    query.orderBy('prediction.createdAt', 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);
    
    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }
}
```

### 3. 趋势预测控制器

```typescript
// backend/src/modules/prediction/prediction.controller.ts
import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePredictionDto, QueryPredictionDto } from './dto/prediction.dto';

@Controller('api/prediction')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('trend')
  async createPrediction(@Body() dto: CreatePredictionDto) {
    const prediction = await this.predictionService.createPrediction(
      dto.eventId,
      dto.horizon
    );
    return { message: '趋势预测已创建', data: prediction };
  }

  @Get('trend/:eventId')
  async getPrediction(@Param('eventId') eventId: string) {
    const prediction = await this.predictionService.getPrediction(+eventId);
    return { data: prediction };
  }

  @Get('trend')
  async listPredictions(@Query() query: QueryPredictionDto) {
    const result = await this.predictionService.listPredictions(query);
    return result;
  }
}
```

### 4. DTO 定义

```typescript
// backend/src/modules/prediction/dto/prediction.dto.ts
import { IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { RiskLevel } from '../../../database/entities/trend-prediction.entity';

export class CreatePredictionDto {
  @Type(() => Number)
  @IsInt()
  eventId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168) // 最多预测 168 小时（7 天）
  horizon: number;
}

export class QueryPredictionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  riskLevel?: RiskLevel;
}
```

---

## 归因分析服务完整实现

### 1. 归因分析模块

```typescript
// backend/src/modules/attribution/attribution.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributionAnalysisEntity } from '../../database/entities/attribution-analysis.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { AttributionService } from './attribution.service';
import { AttributionController } from './attribution.controller';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttributionAnalysisEntity,
      OpinionEventEntity,
    ]),
    AgentsModule,
  ],
  controllers: [AttributionController],
  providers: [AttributionService],
  exports: [AttributionService],
})
export class AttributionModule {}
```

### 2. 归因分析服务（核心代码）

```typescript
// backend/src/modules/attribution/attribution.service.ts
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

  /**
   * 创建归因分析
   */
  async createAnalysis(eventId: number): Promise<AttributionAnalysisEntity> {
    const startTime = Date.now();
    
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('事件不存在');
    }

    // 1. 查找触发事件
    const triggerEvents = await this.findTriggerEvents(event);
    
    // 2. 识别关键节点
    const keyNodes = await this.identifyKeyNodes(event, triggerEvents);
    
    // 3. 构建传播路径
    const propagationPath = this.buildPropagationPath(triggerEvents);
    
    // 4. LLM 生成归因报告
    const analysisContent = await this.generateAnalysisReport(
      event,
      triggerEvents,
      keyNodes
    );
    
    const duration = Date.now() - startTime;
    
    // 保存分析结果
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

  /**
   * 查找触发事件（24小时内的相关事件）
   */
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

  /**
   * 计算事件影响力
   */
  private calculateImpact(event: OpinionEventEntity): number {
    return event.readCount * 0.1 + event.likeCount * 0.3 + event.commentCount * 0.5 + event.shareCount * 0.7;
  }

  /**
   * 识别关键节点
   */
  private async identifyKeyNodes(
    event: OpinionEventEntity,
    triggerEvents: TriggerEvent[]
  ): Promise<KeyNode[]> {
    const nodes: KeyNode[] = [];
    
    // 添加主事件作者
    nodes.push({
      type: this.determineNodeType(event.author),
      name: event.author,
      followersCount: 0, // 实际应从用户表获取
      propagationPower: this.calculateImpact(event),
    });
    
    // 添加触发事件作者
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

  /**
   * 判断节点类型
   */
  private determineNodeType(author: string): 'kol' | 'media' | 'official' {
    if (author.includes('官方') || author.includes('机构')) return 'official';
    if (author.includes('媒体') || author.includes('新闻')) return 'media';
    return 'kol';
  }

  /**
   * 构建传播路径
   */
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

  /**
   * LLM 生成归因分析报告
   */
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
互动数据：阅读 ${event.readCount}，点赞 ${event.likeCount}，评论 ${event.commentCount}

触发事件（${triggerEvents.length} 个）：
${triggerEvents.map((t, i) => `${i + 1}. ${t.title}（影响力：${t.impact.toFixed(0)}）`).join('\n')}

关键节点（${keyNodes.length} 个）：
${keyNodes.map((n, i) => `${i + 1}. ${n.name}（类型：${n.type}，传播力：${n.propagationPower.toFixed(0)}）`).join('\n')}

请从以下角度进行归因分析：
1. 舆情爆发的根本原因是什么？
2. 哪些事件或节点起到了关键作用？
3. 传播路径是如何演变的？
4. 有哪些值得关注的特征？

请生成 500-800 字的分析报告。`;

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

  /**
   * 生成备用报告（LLM 失败时）
   */
  private generateFallbackReport(
    event: OpinionEventEntity,
    triggerEvents: TriggerEvent[],
    keyNodes: KeyNode[]
  ): string {
    return `## 归因分析报告

### 舆情概况
事件「${event.title}」引发了较大关注，总互动量达到 ${event.readCount + event.likeCount + event.commentCount}。

### 触发事件
在该事件爆发前 24 小时内，共发现 ${triggerEvents.length} 个相关事件，其中影响力最大的是：
${triggerEvents.slice(0, 3).map((t, i) => `${i + 1}. ${t.title}`).join('\n')}

### 关键节点
参与传播的关键节点包括 ${keyNodes.length} 个，其中传播力最强的是：
${keyNodes.slice(0, 3).map((n, i) => `${i + 1}. ${n.name}（${n.type}）`).join('\n')}

### 分析结论
该舆情事件的爆发是多因素综合作用的结果，需要持续关注后续发展。

（注：本报告为自动生成的备用版本，建议结合人工分析）`;
  }

  /**
   * 获取归因分析
   */
  async getAnalysis(eventId: number): Promise<AttributionAnalysisEntity | null> {
    return this.attributionRepo.findOne({
      where: { eventId },
      order: { createdAt: 'DESC' },
      relations: ['event'],
    });
  }
}
```

---

## 集成步骤

### 1. 创建模块文件
```bash
mkdir -p backend/src/modules/prediction
mkdir -p backend/src/modules/attribution
```

### 2. 复制上述代码到对应文件

### 3. 注册到 AppModule
```typescript
import { PredictionModule } from './modules/prediction/prediction.module';
import { AttributionModule } from './modules/attribution/attribution.module';

@Module({
  imports: [
    // ... 其他模块
    PredictionModule,
    AttributionModule,
  ],
})
```

### 4. 测试 API
```bash
# 创建趋势预测
curl -X POST http://localhost:3000/api/prediction/trend \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 1, "horizon": 24}'

# 创建归因分析
curl -X POST http://localhost:3000/api/analysis/attribution \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId": 1}'
```

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**实施状态**：服务层完整设计完成
