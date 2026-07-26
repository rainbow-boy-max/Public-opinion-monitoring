import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ReportGenerationEntity, ReportType, ReportStatus } from '../../database/entities/report-generation.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { LlmService } from '../agents/llm.service';

@Injectable()
export class ReportGenerationService {
  private readonly logger = new Logger(ReportGenerationService.name);

  constructor(
    @InjectRepository(ReportGenerationEntity)
    private readonly reportRepo: Repository<ReportGenerationEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
    private readonly llmService: LlmService,
  ) {}

  async createReport(data: {
    reportType: ReportType;
    title: string;
    startDate: Date;
    endDate: Date;
    createdBy: number;
  }): Promise<ReportGenerationEntity> {
    const report = this.reportRepo.create(data);
    await this.reportRepo.save(report);
    
    this.generateReportAsync(report.id);
    
    return report;
  }

  async generateReportAsync(reportId: number): Promise<void> {
    try {
      const report = await this.reportRepo.findOne({ where: { id: reportId } });
      if (!report) return;

      await this.reportRepo.update(reportId, { status: ReportStatus.GENERATING });

      const events = await this.collectEvents(report.startDate, report.endDate);
      const content = await this.generateContent(report.reportType, events, report.startDate, report.endDate);
      
      await this.reportRepo.update(reportId, {
        status: ReportStatus.COMPLETED,
        content,
        completedAt: new Date(),
      });

      this.logger.log(`Report ${reportId} generated successfully`);
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}: ${error.message}`);
      await this.reportRepo.update(reportId, {
        status: ReportStatus.FAILED,
        errorMessage: error.message,
      });
    }
  }

  private async collectEvents(startDate: Date, endDate: Date): Promise<OpinionEventEntity[]> {
    return this.eventRepo.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: {
        createdAt: 'DESC',
      },
      take: 100,
    });
  }

  private async generateContent(
    reportType: ReportType,
    events: OpinionEventEntity[],
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const template = this.getTemplate(reportType);
    const data = this.prepareData(events, startDate, endDate);
    
    try {
      const prompt = this.buildPrompt(template, data);
      const llmResponse = await this.llmService.chat({
        baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.LLM_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      return this.fillTemplate(template, data, llmResponse.content);
    } catch (error) {
      this.logger.warn(`LLM generation failed: ${error.message}, using template only`);
      return this.fillTemplate(template, data, '{}');
    }
  }

  private getTemplate(reportType: ReportType): string {
    switch (reportType) {
      case ReportType.DAILY:
        return `# 舆情监测日报
日期：{{date}}

## 一、舆情概览
- 监测事件数：{{eventCount}}
- 新增舆情：{{newEventCount}}
- 热度 TOP 5：
{{topEvents}}

## 二、热点事件分析
{{eventAnalysis}}

## 三、情感趋势
{{sentimentTrend}}

## 四、应对建议
{{suggestions}}`;

      case ReportType.WEEKLY:
        return `# 舆情监测周报
时间范围：{{dateRange}}

## 一、本周概览
- 监测事件总数：{{eventCount}}
- 新增事件：{{newEventCount}}

## 二、热点事件TOP 10
{{topEvents}}

## 三、舆情趋势分析
{{trendAnalysis}}

## 四、情感分布
{{sentimentDistribution}}

## 五、应对建议
{{suggestions}}`;

      case ReportType.MONTHLY:
        return `# 舆情监测月报
时间范围：{{dateRange}}

## 一、月度数据总览
- 监测事件总数：{{eventCount}}
- 新增事件：{{newEventCount}}

## 二、热点事件回顾
{{topEvents}}

## 三、舆情趋势分析
{{trendAnalysis}}

## 四、应对建议
{{suggestions}}`;

      case ReportType.SPECIAL:
        return `# 专项舆情分析报告
{{title}}

## 一、事件概况
- 事件数量：{{eventCount}}
- 时间范围：{{dateRange}}

## 二、详细分析
{{eventAnalysis}}

## 三、应对建议
{{suggestions}}`;
    }
  }

  private prepareData(events: OpinionEventEntity[], startDate: Date, endDate: Date): any {
    const eventCount = events.length;
    const newEventCount = events.filter(e => e.createdAt >= startDate).length;
    
    const sentimentDistribution = {
      positive: events.filter(e => e.sentiment === 'positive').length,
      negative: events.filter(e => e.sentiment === 'negative').length,
      neutral: events.filter(e => e.sentiment === 'neutral').length,
    };

    const topEvents = events.slice(0, 10).map(e => ({
      title: e.title,
      readCount: e.readCount,
      likeCount: e.likeCount,
      commentCount: e.commentCount,
      sentiment: e.sentiment,
      createdAt: e.createdAt,
    }));

    return {
      date: startDate.toISOString().split('T')[0],
      dateRange: `${startDate.toISOString().split('T')[0]} 至 ${endDate.toISOString().split('T')[0]}`,
      eventCount,
      newEventCount,
      sentimentDistribution,
      topEvents,
      events,
    };
  }

  private buildPrompt(template: string, data: any): string {
    return `请根据以下数据生成舆情报告内容：

数据摘要：
- 事件总数：${data.eventCount}
- 新增事件：${data.newEventCount}
- 情感分布：正面 ${data.sentimentDistribution.positive}，负面 ${data.sentimentDistribution.negative}，中性 ${data.sentimentDistribution.neutral}

TOP 事件：
${data.topEvents.map((e: any, i: number) => `${i + 1}. ${e.title}（阅读：${e.readCount}，点赞：${e.likeCount}，情感：${e.sentiment}）`).join('\n')}

要求：
1. 生成「热点事件分析」部分，提炼核心问题和关键风险
2. 生成「情感趋势」分析
3. 生成「应对建议」（3-5 条，具体可操作）

请以 JSON 格式返回：
{
  "eventAnalysis": "...",
  "sentimentTrend": "...",
  "trendAnalysis": "...",
  "sentimentDistribution": "...",
  "suggestions": ["...", "...", "..."]
}`;
  }

  private fillTemplate(template: string, data: any, generated: string): string {
    let content = template;
    
    content = content.replace('{{date}}', data.date);
    content = content.replace(/{{dateRange}}/g, data.dateRange);
    content = content.replace(/{{eventCount}}/g, data.eventCount.toString());
    content = content.replace(/{{newEventCount}}/g, data.newEventCount.toString());
    
    const topEventsList = data.topEvents
      .map((e: any, i: number) => `  ${i + 1}. ${e.title}（阅读：${e.readCount}，点赞：${e.likeCount}）`)
      .join('\n');
    content = content.replace('{{topEvents}}', topEventsList);
    
    try {
      const parsed = JSON.parse(generated);
      content = content.replace('{{eventAnalysis}}', parsed.eventAnalysis || '暂无分析');
      content = content.replace('{{sentimentTrend}}', parsed.sentimentTrend || '暂无趋势');
      content = content.replace('{{trendAnalysis}}', parsed.trendAnalysis || '暂无趋势分析');
      content = content.replace('{{sentimentDistribution}}', parsed.sentimentDistribution || '暂无情感分布');
      content = content.replace('{{suggestions}}', parsed.suggestions?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || '暂无建议');
    } catch (error) {
      this.logger.warn('Failed to parse LLM response, using fallback content');
      content = content.replace('{{eventAnalysis}}', '正在分析中...');
      content = content.replace('{{sentimentTrend}}', '正在分析中...');
      content = content.replace('{{trendAnalysis}}', '正在分析中...');
      content = content.replace('{{sentimentDistribution}}', '正在分析中...');
      content = content.replace('{{suggestions}}', '正在生成建议...');
    }
    
    return content;
  }

  async listReports(params: {
    page?: number;
    pageSize?: number;
    reportType?: ReportType;
    status?: ReportStatus;
  }): Promise<{ data: ReportGenerationEntity[]; total: number }> {
    const { page = 1, pageSize = 20, reportType, status } = params;
    
    const query = this.reportRepo.createQueryBuilder('report')
      .leftJoinAndSelect('report.creator', 'user');
    
    if (reportType) {
      query.andWhere('report.reportType = :reportType', { reportType });
    }
    
    if (status) {
      query.andWhere('report.status = :status', { status });
    }
    
    query.orderBy('report.createdAt', 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);
    
    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  async getReport(id: number): Promise<ReportGenerationEntity | null> {
    return this.reportRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
  }

  async deleteReport(id: number): Promise<void> {
    await this.reportRepo.delete(id);
  }
}
