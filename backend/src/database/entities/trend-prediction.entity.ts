import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OpinionEventEntity } from './opinion-event.entity';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PredictedDataPoint {
  timestamp: Date;
  value: number;
}

@Entity('trend_predictions')
export class TrendPredictionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'prediction_horizon', type: 'int', comment: '预测时长（小时）' })
  predictionHorizon: number;

  @Column({ name: 'predicted_heat', type: 'json', comment: '预测热度数据点' })
  predictedHeat: PredictedDataPoint[];

  @Column({ name: 'risk_level', type: 'varchar', length: 32 })
  riskLevel: RiskLevel;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, comment: '置信度分数' })
  confidenceScore: number;

  @Column({ name: 'anomaly_detected', type: 'boolean', default: false, comment: '是否检测到异常' })
  anomalyDetected: boolean;

  @Column({ name: 'algorithm_used', type: 'varchar', length: 64, default: 'moving_average', comment: '使用的算法' })
  algorithmUsed: string;

  @Column({ name: 'historical_data_points', type: 'int', comment: '使用的历史数据点数量' })
  historicalDataPoints: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
