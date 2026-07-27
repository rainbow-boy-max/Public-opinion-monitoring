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

  async createPrediction(eventId: number, horizon: number): Promise<TrendPredictionEntity> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('事件不存在');
    }

    const historicalData = await this.collectHistoricalData(eventId);
    
    if (historicalData.length < 7) {
      throw new Error('历史数据不足，至少需要 7 个数据点');
    }

    const predictedHeat = this.predictByMovingAverage(historicalData, horizon);
    
    const anomalyDetected = this.detectAnomaly(
      event.readCount + event.likeCount + event.commentCount,
      historicalData.map(d => d.heat)
    );
    
    const riskLevel = this.assessRisk(
      predictedHeat.map(p => p.value),
      event.readCount + event.likeCount + event.commentCount
    );
    
    const confidenceScore = this.calculateConfidence(historicalData);
    
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

  private async collectHistoricalData(eventId: number): Promise<HistoricalDataPoint[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) return [];
    
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

  private predictByMovingAverage(
    historicalData: HistoricalDataPoint[],
    horizon: number
  ): PredictedDataPoint[] {
    const predictions: PredictedDataPoint[] = [];
    
    const growthRates: number[] = [];
    for (let i = 1; i < historicalData.length; i++) {
      if (historicalData[i - 1].heat === 0) continue;
      const rate = (historicalData[i].heat - historicalData[i - 1].heat) / historicalData[i - 1].heat;
      growthRates.push(rate);
    }
    
    const avgGrowthRate = growthRates.length > 0
      ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
      : 0;
    
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

  private detectAnomaly(currentValue: number, historicalValues: number[]): boolean {
    if (historicalValues.length < 3) return false;
    
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues
      .map(x => Math.pow(x - mean, 2))
      .reduce((a, b) => a + b, 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.abs(currentValue - mean) > 3 * stdDev;
  }

  private assessRisk(predictedHeat: number[], currentHeat: number): RiskLevel {
    if (predictedHeat.length === 0) return 'low';
    
    const maxPredicted = Math.max(...predictedHeat);
    if (currentHeat === 0) return 'low';
    
    const growthRate = (maxPredicted - currentHeat) / currentHeat;
    
    if (growthRate > 2) return 'critical';
    if (growthRate > 1) return 'high';
    if (growthRate > 0.5) return 'medium';
    return 'low';
  }

  private calculateConfidence(historicalData: HistoricalDataPoint[]): number {
    const dataPoints = historicalData.length;
    let baseConfidence = Math.min(dataPoints / 14, 1) * 50;
    
    const values = historicalData.map(d => d.heat);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length;
    const cv = mean === 0 ? 1 : Math.sqrt(variance) / mean;
    
    const stabilityScore = Math.max(0, 50 - cv * 25);
    
    return Math.round(baseConfidence + stabilityScore);
  }

  async getPrediction(eventId: number): Promise<TrendPredictionEntity | null> {
    return this.predictionRepo.findOne({
      where: { eventId },
      order: { createdAt: 'DESC' },
      relations: ['event'],
    });
  }

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
