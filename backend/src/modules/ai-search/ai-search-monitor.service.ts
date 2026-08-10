import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorTaskEntity } from '../../database/entities/monitor-task.entity';

export interface AiSearchMention {
  query: string;
  keyword: string;
  source: string;
  snippet: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  detectedAt: Date;
}

export interface AiSearchReport {
  keyword: string;
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  sources: string[];
  samples: AiSearchMention[];
  lastChecked: Date;
}

@Injectable()
export class AiSearchMonitorService {
  private readonly logger = new Logger(AiSearchMonitorService.name);

  constructor(
    @InjectRepository(MonitorTaskEntity)
    private readonly taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  async checkKeyword(keyword: string): Promise<AiSearchReport> {
    const mentions = await this.simulateAiSearch(keyword);

    const positiveCount = mentions.filter((m) => m.sentiment === 'positive').length;
    const negativeCount = mentions.filter((m) => m.sentiment === 'negative').length;
    const neutralCount = mentions.filter((m) => m.sentiment === 'neutral').length;
    const sources = [...new Set(mentions.map((m) => m.source))];

    return {
      keyword,
      totalMentions: mentions.length,
      positiveCount,
      negativeCount,
      neutralCount,
      sources,
      samples: mentions.slice(0, 10),
      lastChecked: new Date(),
    };
  }

  async checkAllKeywords(): Promise<AiSearchReport[]> {
    const tasks = await this.taskRepo.find({ where: { status: 'enabled' as any } });
    const keywords = new Set<string>();
    for (const task of tasks) {
      try {
        const kws = JSON.parse(task.keywords) as string[];
        kws.forEach((k) => keywords.add(k));
      } catch { /* ignore */ }
    }

    const results: AiSearchReport[] = [];
    for (const kw of keywords) {
      try {
        const report = await this.checkKeyword(kw);
        results.push(report);
      } catch (err) {
        this.logger.warn(`AI search check failed for keyword "${kw}": ${(err as Error).message}`);
      }
    }

    return results;
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledCheck(): Promise<void> {
    this.logger.log('Running scheduled AI search visibility check');
    await this.checkAllKeywords();
  }

  private async simulateAiSearch(keyword: string): Promise<AiSearchMention[]> {
    const sources = ['ChatGPT', 'DeepSeek', 'Kimi', 'Gemini', '文心一言', '通义千问'];
    const mentions: AiSearchMention[] = [];

    for (const source of sources) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
        mentions.push({
          query: `关于${keyword}的${source}搜索结果`,
          keyword,
          source,
          snippet: `${source} 对 "${keyword}" 的搜索结果摘要 - 第${i + 1}条`,
          sentiment: sentiments[Math.floor(Math.random() * 3)],
          detectedAt: new Date(),
        });
      }
    }

    return mentions;
  }
}