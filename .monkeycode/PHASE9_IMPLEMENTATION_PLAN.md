# Phase 9 实施计划 - 趋势预判与智能归因

## 目标

构建舆情趋势预测模型与智能归因分析能力，提升预警前瞻性。

---

## 核心功能

### 1. 趋势预测模型
- 基于历史数据预测未来 24h/72h 舆情热度走势
- 识别潜在爆发风险
- 异常检测与自动预警

### 2. 智能归因分析
- 分析舆情爆发的触发事件
- 识别关键传播节点（KOL、媒体）
- 生成归因分析报告

### 3. 可视化展示
- 趋势预测曲线
- 归因分析图谱
- 异常点标注

---

## 技术架构

### 方案选择

考虑到当前项目规模和实施成本，我们采用**轻量化实施方案**：

#### 方案 A：完整机器学习方案（原计划）
- Python FastAPI 微服务
- TensorFlow/PyTorch 训练模型
- 独立部署
- **缺点**：实施周期长（7 周）、资源需求大

#### 方案 B：轻量化实施方案（推荐）✅
- 基于统计方法的趋势预测
- 使用现有 Node.js 后端
- LLM 辅助归因分析
- 快速实施（2-3 周）

---

## 数据模型设计

### 1. 趋势预测记录表

```typescript
// trend-prediction.entity.ts
@Entity('trend_predictions')
export class TrendPredictionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'prediction_horizon', type: 'int', comment: '预测时长（小时）' })
  predictionHorizon: number; // 24 或 72

  @Column({ name: 'predicted_heat', type: 'json', comment: '预测热度数据点' })
  predictedHeat: { timestamp: Date; value: number }[];

  @Column({ name: 'risk_level', type: 'varchar', length: 32 })
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2 })
  confidenceScore: number;

  @Column({ name: 'anomaly_detected', type: 'boolean', default: false })
  anomalyDetected: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 2. 归因分析记录表

```typescript
// attribution-analysis.entity.ts
@Entity('attribution_analyses')
export class AttributionAnalysisEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'trigger_events', type: 'json', comment: '触发事件列表' })
  triggerEvents: {
    eventId: number;
    title: string;
    time: Date;
    impact: number;
  }[];

  @Column({ name: 'key_nodes', type: 'json', comment: '关键传播节点' })
  keyNodes: {
    type: 'kol' | 'media' | 'official';
    name: string;
    followersCount: number;
    propagationPower: number;
  }[];

  @Column({ name: 'propagation_path', type: 'json', comment: '传播路径' })
  propagationPath: {
    source: string;
    target: string;
    weight: number;
  }[];

  @Column({ name: 'analysis_content', type: 'longtext', comment: '归因分析内容' })
  analysisContent: string;

  @Column({ name: 'llm_generated', type: 'boolean', default: true })
  llmGenerated: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## 实施方案

### Phase 9.1：数据模型与基础服务（1 周）

**任务清单**：
- [ ] 创建 TrendPredictionEntity
- [ ] 创建 AttributionAnalysisEntity
- [ ] 创建 PredictionModule
- [ ] 创建 AttributionModule
- [ ] 注册到 AppModule 和 data-source.ts

### Phase 9.2：趋势预测服务（1 周）

**核心算法**：
- 移动平均法（简单、快速）
- 线性回归（基于历史数据）
- 异常检测（基于统计阈值）

**实现步骤**：
1. 采集历史数据（最近 7 天）
2. 计算趋势指标（增长率、波动率）
3. 预测未来数据点（24h/72h）
4. 风险评级（low/medium/high/critical）
5. 保存预测结果

**API 端点**：
```typescript
POST /api/prediction/trend
{
  eventId: 123,
  horizon: 24 // 24h 或 72h
}

GET /api/prediction/trend/:eventId
// 返回最新预测结果
```

### Phase 9.3：归因分析服务（1 周）

**核心算法**：
- 时间序列分析（查找爆发前的关联事件）
- 传播网络分析（识别关键节点）
- LLM 生成归因报告

**实现步骤**：
1. 采集相关事件（时间窗口：爆发前 24h）
2. 分析传播路径（基于作者、转发关系）
3. 识别关键节点（KOL、媒体）
4. LLM 生成归因分析报告
5. 保存分析结果

**API 端点**：
```typescript
POST /api/analysis/attribution
{
  eventId: 123
}

GET /api/analysis/attribution/:eventId
// 返回归因分析结果
```

### Phase 9.4：前端可视化（1.5 周）

**页面设计**：

1. **趋势预测看板**
   - 事件列表（可预测的事件）
   - 预测曲线图（ECharts）
   - 风险等级标签
   - 异常点标注

2. **归因分析详情页**
   - 触发事件时间线
   - 关键节点列表
   - 传播路径图谱（ECharts Graph）
   - LLM 生成的分析报告

### Phase 9.5：测试与优化（0.5 周）

- 功能测试
- 性能测试
- 准确度验证
- 文档完善

---

## 技术实现细节

### 趋势预测算法（简化版）

```typescript
class TrendPredictor {
  // 移动平均预测
  async predictByMovingAverage(
    historicalData: { time: Date; heat: number }[],
    horizon: number
  ): Promise<{ timestamp: Date; value: number }[]> {
    const windowSize = 7; // 7 天移动窗口
    const predictions = [];
    
    // 计算平均增长率
    const growthRates = [];
    for (let i = 1; i < historicalData.length; i++) {
      const rate = (historicalData[i].heat - historicalData[i-1].heat) / historicalData[i-1].heat;
      growthRates.push(rate);
    }
    
    const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
    
    // 预测未来数据点
    let lastValue = historicalData[historicalData.length - 1].heat;
    const lastTime = historicalData[historicalData.length - 1].time;
    
    for (let h = 1; h <= horizon; h++) {
      const predictedValue = lastValue * (1 + avgGrowthRate);
      predictions.push({
        timestamp: new Date(lastTime.getTime() + h * 3600000),
        value: Math.round(predictedValue)
      });
      lastValue = predictedValue;
    }
    
    return predictions;
  }

  // 异常检测
  detectAnomaly(currentValue: number, historicalValues: number[]): boolean {
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const stdDev = Math.sqrt(
      historicalValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / historicalValues.length
    );
    
    // 3σ 原则
    return Math.abs(currentValue - mean) > 3 * stdDev;
  }

  // 风险评级
  assessRisk(predictedHeat: number[], currentHeat: number): 'low' | 'medium' | 'high' | 'critical' {
    const maxPredicted = Math.max(...predictedHeat);
    const growthRate = (maxPredicted - currentHeat) / currentHeat;
    
    if (growthRate > 2) return 'critical';
    if (growthRate > 1) return 'high';
    if (growthRate > 0.5) return 'medium';
    return 'low';
  }
}
```

### 归因分析算法（LLM 辅助）

```typescript
class AttributionAnalyzer {
  async analyze(event: OpinionEventEntity): Promise<AttributionAnalysisEntity> {
    // 1. 采集相关事件
    const relatedEvents = await this.findRelatedEvents(event);
    
    // 2. 识别关键节点
    const keyNodes = await this.identifyKeyNodes(event);
    
    // 3. 构建传播路径
    const propagationPath = await this.buildPropagationPath(relatedEvents);
    
    // 4. LLM 生成归因报告
    const prompt = this.buildAttributionPrompt(event, relatedEvents, keyNodes);
    const analysis = await this.llmService.chat({
      messages: [{ role: 'user', content: prompt }],
      // ... LLM 配置
    });
    
    return {
      eventId: event.id,
      triggerEvents: relatedEvents.map(e => ({
        eventId: e.id,
        title: e.title,
        time: e.publishTime,
        impact: this.calculateImpact(e),
      })),
      keyNodes: keyNodes,
      propagationPath: propagationPath,
      analysisContent: analysis.content,
      llmGenerated: true,
    };
  }
}
```

---

## 工期与资源

| 阶段 | 任务 | 工期 | 状态 |
|------|------|------|------|
| 9.1 | 数据模型与基础服务 | 1 周 | ⏳ 待开始 |
| 9.2 | 趋势预测服务 | 1 周 | ⏳ 待开始 |
| 9.3 | 归因分析服务 | 1 周 | ⏳ 待开始 |
| 9.4 | 前端可视化 | 1.5 周 | ⏳ 待开始 |
| 9.5 | 测试与优化 | 0.5 周 | ⏳ 待开始 |
| **总计** | - | **5 周** | - |

**人力需求**：
- 后端开发：1 人
- 前端开发：1 人

**相比原计划优化**：
- 工期从 7 周减少到 5 周
- 无需独立的 Python 服务
- 无需机器学习专家
- 降低部署复杂度

---

## 下一步行动

### 立即开始（本周）

1. **创建数据模型**
   - TrendPredictionEntity
   - AttributionAnalysisEntity

2. **创建基础模块**
   - PredictionModule
   - AttributionModule

3. **实现趋势预测服务**
   - 移动平均算法
   - 异常检测
   - 风险评级

### 下周

1. 实现归因分析服务
2. 实现前端可视化
3. 集成测试

---

**文档版本**：v1.0  
**更新日期**：2026-07-23  
**预计完成时间**：5 周  
**状态**：准备开始
