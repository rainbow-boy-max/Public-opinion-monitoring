import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpinionEventEntity } from '../../database/entities';

export interface CalibrationResult {
  eventId: number;
  originalSentiment: string;
  calibratedSentiment: string;
  originalConfidence: number;
  calibratedConfidence: number;
  calibrationReason: string;
  isSarcasm: boolean;
  isContextAware: boolean;
}

@Injectable()
export class SentimentCalibratorService {
  private readonly logger = new Logger(SentimentCalibratorService.name);

  private readonly sarcasmPatterns = [
    { pattern: /真[的得地]?[棒好好厉害聪明]/i, weight: 0.6 },
    { pattern: /太[棒好好厉害]了[吧吗]?/i, weight: 0.5 },
    { pattern: /真是[太很]?[棒好好]/i, weight: 0.5 },
    { pattern: /就这么[简单容易]?/i, weight: 0.3 },
    { pattern: /这也[叫算]?[好厉害]/i, weight: 0.4 },
    { pattern: /服了[。！!]?$/i, weight: 0.3 },
    { pattern: /呵呵|哈哈|嘻嘻/i, weight: 0.3 },
    { pattern: /不愧[是]?[你他她]/i, weight: 0.4 },
    { pattern: /[三天两天一周]就[坏了出问题挂了]/i, weight: 0.7 },
    { pattern: /质量[真太]?[棒好好].*[坏出问题]/i, weight: 0.8 },
  ];

  private readonly negatePatterns = [
    /不[是会想能行]/i, /没[有什办法]/i, /[毫]?无[法用]/i,
  ];

  private readonly amplificationPatterns = [
    { pattern: /太[太非常极其]/i, weight: 0.2 },
    { pattern: /[简绝]?[对地]?[愤怒失望生气]/i, weight: 0.3 },
    { pattern: /[严极其万分]/i, weight: 0.2 },
  ];

  constructor(
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
  ) {}

  async calibrateEvent(eventId: number): Promise<CalibrationResult> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new Error(`Event ${eventId} not found`);

    const text = `${event.title} ${event.content}`;
    const result = this.calibrate(text, event.sentiment, event.sentimentConfidence || 0.5);

    await this.eventRepo.update(eventId, {
      sentiment: result.calibratedSentiment as any,
      sentimentScore: result.calibratedSentiment === 'positive' ? 0.8 :
        result.calibratedSentiment === 'negative' ? -0.8 : 0,
      sentimentConfidence: result.calibratedConfidence,
      sentimentSource: 'calibrated',
    } as any);

    return { ...result, eventId };
  }

  async calibrateTask(taskId: number): Promise<{ total: number; calibrated: number }> {
    const events = await this.eventRepo.find({ where: { taskId: taskId as any } });
    let calibrated = 0;

    for (const event of events) {
      try {
        const text = `${event.title} ${event.content}`;
        const result = this.calibrate(text, event.sentiment, event.sentimentConfidence || 0.5);

        if (result.calibratedSentiment !== result.originalSentiment || result.calibratedConfidence !== result.originalConfidence) {
          await this.eventRepo.update(event.id, {
            sentiment: result.calibratedSentiment as any,
            sentimentScore: result.calibratedSentiment === 'positive' ? 0.8 :
              result.calibratedSentiment === 'negative' ? -0.8 : 0,
            sentimentConfidence: result.calibratedConfidence,
            sentimentSource: 'calibrated',
          } as any);
          calibrated++;
        }
      } catch (err) {
        this.logger.warn(`Calibrate event ${event.id} failed: ${(err as Error).message}`);
      }
    }

    return { total: events.length, calibrated };
  }

  calibrate(
    text: string,
    originalSentiment: string,
    originalConfidence: number,
  ): Omit<CalibrationResult, 'eventId'> {
    const isSarcasm = this.detectSarcasm(text);
    const hasNegation = this.hasNegationNearSentiment(text);
    const amplification = this.getAmplification(text);

    let calibratedSentiment = originalSentiment;
    let calibratedConfidence = originalConfidence;
    const reasons: string[] = [];

    if (isSarcasm.detected) {
      if (originalSentiment === 'positive') {
        calibratedSentiment = 'negative';
        reasons.push(`反讽检测: "${isSarcasm.matched}" (权重${isSarcasm.weight})`);
        calibratedConfidence = Math.min(1, originalConfidence * 0.85 + isSarcasm.weight * 0.3);
      } else if (originalSentiment === 'neutral') {
        calibratedSentiment = 'negative';
        reasons.push(`反讽检测: "${isSarcasm.matched}" → 负面`);
        calibratedConfidence = Math.min(1, originalConfidence * 0.7 + isSarcasm.weight * 0.2);
      }
    }

    if (hasNegation) {
      if (originalSentiment === 'positive') {
        calibratedSentiment = 'negative';
        reasons.push('否定词反转: 正面表达被否定');
        calibratedConfidence = Math.min(1, calibratedConfidence * 0.9 + 0.15);
      } else if (originalSentiment === 'negative') {
        calibratedSentiment = 'positive';
        reasons.push('否定词反转: 负面表达被否定');
        calibratedConfidence = Math.min(1, calibratedConfidence * 0.9 + 0.15);
      }
    }

    if (amplification > 0 && calibratedConfidence < 0.9) {
      calibratedConfidence = Math.min(0.95, calibratedConfidence + amplification * 0.15);
      reasons.push('情绪增强词提升置信度');
    }

    if (originalSentiment === 'neutral' && calibratedSentiment === 'neutral' && originalConfidence < 0.3) {
      const wordCount = text.length;
      if (wordCount > 100) {
        calibratedConfidence = Math.min(0.5, originalConfidence + 0.15);
        reasons.push('文本长度较长，提高中性置信度');
      }
    }

    return {
      originalSentiment,
      calibratedSentiment,
      originalConfidence,
      calibratedConfidence: Math.round(calibratedConfidence * 100) / 100,
      calibrationReason: reasons.join('; ') || '未发现需要校准',
      isSarcasm: isSarcasm.detected,
      isContextAware: false,
    };
  }

  private detectSarcasm(text: string): { detected: boolean; matched: string; weight: number } {
    let maxWeight = 0;
    let matched = '';

    for (const sp of this.sarcasmPatterns) {
      const match = text.match(sp.pattern);
      if (match) {
        if (sp.weight > maxWeight) {
          maxWeight = sp.weight;
          matched = match[0];
        }
      }
    }

    return { detected: maxWeight > 0.3, matched, weight: maxWeight };
  }

  private hasNegationNearSentiment(text: string): boolean {
    return this.negatePatterns.some((p) => p.test(text));
  }

  private getAmplification(text: string): number {
    let totalWeight = 0;
    for (const ap of this.amplificationPatterns) {
      const matches = text.match(ap.pattern);
      if (matches) totalWeight += ap.weight * matches.length;
    }
    return Math.min(1, totalWeight);
  }
}