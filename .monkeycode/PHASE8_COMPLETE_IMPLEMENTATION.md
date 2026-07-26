# Phase 8 完整实施方案 - AI 智能报告生成

## 一、数据模型

### 1. 报告生成记录实体

```typescript
// backend/src/database/entities/report-generation.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';

export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  SPECIAL = 'special',
}

export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ExportFormat {
  WORD = 'word',
  PDF = 'pdf',
}

@Entity('report_generations')
export class ReportGenerationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'report_type', type: 'varchar', length: 32 })
  reportType: ReportType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ type: 'varchar', length: 32, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'longtext', nullable: true, comment: '报告内容（Markdown）' })
  content: string | null;

  @Column({ name: 'export_format', type: 'varchar', length: 32, nullable: true })
  exportFormat: ExportFormat | null;

  @Column({ name: 'export_url', type: 'text', nullable: true })
  exportUrl: string | null;

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
}
```

---

## 二、报告生成引擎

### 1. 报告生成服务

```typescript
// backend/src/modules/report-generation/report-generation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ReportGenerationEntity, ReportType, ReportStatus } from '../../database/entities/report-generation.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { LlmModelsService } from '../agents/llm-models.service';

@Injectable()
export class ReportGenerationService {
  private readonly logger = new Logger(ReportGenerationService.name);

  constructor(
    @InjectRepository(ReportGenerationEntity)
    private readonly reportRepo: Repository<ReportGenerationEntity>,
    @InjectRepository(OpinionEventEntity)
    private readonly eventRepo: Repository<OpinionEventEntity>,
    private readonly llmService: LlmModelsService,
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
    
    // 异步生成报告
    this.generateReportAsync(report.id);
    
    return report;
  }

  async generateReportAsync(reportId: number): Promise<void> {
    try {
      const report = await this.reportRepo.findOne({ where: { id: reportId } });
      if (!report) return;

      await this.reportRepo.update(reportId, { status: ReportStatus.GENERATING });

      // 1. 采集数据
      const events = await this.collectEvents(report.startDate, report.endDate);
      
      // 2. 生成报告内容
      const content = await this.generateContent(report.reportType, events, report.startDate, report.endDate);
      
      // 3. 更新报告
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
    
    // 使用 LLM 生成智能内容
    const prompt = this.buildPrompt(template, data);
    const generatedContent = await this.llmService.complete(prompt);
    
    // 填充模板
    return this.fillTemplate(template, data, generatedContent);
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
- 处理完成：{{completedCount}}
- 正在处理：{{processingCount}}

## 二、热点事件TOP 10
{{topEvents}}

## 三、舆情趋势分析
{{trendAnalysis}}

## 四、情感分布
{{sentimentDistribution}}

## 五、重点事件深度分析
{{deepAnalysis}}

## 六、下周预判与建议
{{nextWeekForecast}}`;

      case ReportType.MONTHLY:
        return `# 舆情监测月报
时间范围：{{dateRange}}

## 一、月度数据总览
{{monthlyOverview}}

## 二、热点事件回顾
{{topEventsReview}}

## 三、舆情趋势分析
{{trendAnalysis}}

## 四、行业对比分析
{{industryComparison}}

## 五、危机事件复盘
{{crisisReview}}

## 六、下月预判与策略建议
{{nextMonthStrategy}}`;

      case ReportType.SPECIAL:
        return `# 专项舆情分析报告
{{title}}

## 一、事件背景
{{background}}

## 二、舆情发展脉络
{{timeline}}

## 三、传播路径分析
{{propagationAnalysis}}

## 四、公众情绪分析
{{sentimentAnalysis}}

## 五、影响评估
{{impactAssessment}}

## 六、应对措施与建议
{{recommendations}}`;
    }
  }

  private prepareData(events: OpinionEventEntity[], startDate: Date, endDate: Date): any {
    const eventCount = events.length;
    const newEventCount = events.filter(e => e.createdAt >= startDate).length;
    
    // 统计情感分布
    const sentimentDistribution = {
      positive: events.filter(e => e.sentiment === 'positive').length,
      negative: events.filter(e => e.sentiment === 'negative').length,
      neutral: events.filter(e => e.sentiment === 'neutral').length,
    };

    // TOP 事件
    const topEvents = events.slice(0, 10).map(e => ({
      title: e.title,
      heat: e.heat,
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
${data.topEvents.map((e: any, i: number) => `${i + 1}. ${e.title}（热度：${e.heat}，情感：${e.sentiment}）`).join('\n')}

要求：
1. 生成「热点事件分析」部分，提炼核心问题和关键风险
2. 生成「情感趋势」分析
3. 生成「应对建议」（3-5 条，具体可操作）

请以 JSON 格式返回：
{
  "eventAnalysis": "...",
  "sentimentTrend": "...",
  "suggestions": ["...", "...", "..."]
}`;
  }

  private fillTemplate(template: string, data: any, generated: string): string {
    let content = template;
    
    // 替换基础数据
    content = content.replace('{{date}}', data.date);
    content = content.replace('{{dateRange}}', data.dateRange);
    content = content.replace('{{eventCount}}', data.eventCount.toString());
    content = content.replace('{{newEventCount}}', data.newEventCount.toString());
    
    // 替换 TOP 事件
    const topEventsList = data.topEvents
      .map((e: any, i: number) => `  ${i + 1}. ${e.title}（热度：${e.heat}）`)
      .join('\n');
    content = content.replace('{{topEvents}}', topEventsList);
    
    // 替换 LLM 生成内容
    try {
      const parsed = JSON.parse(generated);
      content = content.replace('{{eventAnalysis}}', parsed.eventAnalysis || '暂无分析');
      content = content.replace('{{sentimentTrend}}', parsed.sentimentTrend || '暂无趋势');
      content = content.replace('{{suggestions}}', parsed.suggestions?.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || '暂无建议');
    } catch (error) {
      this.logger.warn('Failed to parse LLM response, using fallback content');
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
```

---

## 三、报告导出功能

### 1. Word 导出

```bash
npm install docx
```

```typescript
// backend/src/modules/report-generation/exporters/word-exporter.ts
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import * as marked from 'marked';

export class WordExporter {
  async export(content: string, title: string): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        children: this.parseMarkdown(content, title),
      }],
    });
    
    return Packer.toBuffer(doc);
  }

  private parseMarkdown(content: string, title: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    // 标题
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
      })
    );
    
    // 简单的 Markdown 解析（生产环境建议使用专业库）
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        paragraphs.push(new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
        }));
      } else if (line.startsWith('## ')) {
        paragraphs.push(new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
        }));
      } else if (line.startsWith('### ')) {
        paragraphs.push(new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
        }));
      } else if (line.trim()) {
        paragraphs.push(new Paragraph({
          children: [new TextRun(line)],
        }));
      }
    }
    
    return paragraphs;
  }
}
```

### 2. PDF 导出

```bash
npm install puppeteer marked
```

```typescript
// backend/src/modules/report-generation/exporters/pdf-exporter.ts
import puppeteer from 'puppeteer';
import * as marked from 'marked';

export class PdfExporter {
  async export(content: string, title: string): Promise<Buffer> {
    const html = this.generateHtml(content, title);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setContent(html);
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });
    
    await browser.close();
    
    return Buffer.from(pdf);
  }

  private generateHtml(content: string, title: string): string {
    const htmlContent = marked.parse(content);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: "Microsoft YaHei", "SimSun", sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 2px solid #409EFF;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    h2 {
      color: #333;
      margin-top: 25px;
    }
    h3 {
      color: #666;
      margin-top: 20px;
    }
    p {
      text-align: justify;
      margin: 10px 0;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;
  }
}
```

---

## 四、前端实现

### 1. 报告列表页

`frontend-admin/src/views/reports/index.vue`

核心功能：
- 报告列表展示（表格）
- 筛选：报告类型、状态、日期范围
- 操作：查看、导出、删除
- 创建报告按钮

### 2. 报告创建向导

`frontend-admin/src/views/reports/create.vue`

步骤：
1. 选择报告类型（日报/周报/月报/专项）
2. 设置时间范围
3. 输入报告标题
4. 确认并生成

### 3. 报告详情页

`frontend-admin/src/views/reports/detail.vue`

功能：
- Markdown 预览
- 导出按钮（Word、PDF）
- 编辑功能（可选）

---

## 五、实施计划

| 任务 | 工期 | 状态 |
|------|------|------|
| 报告数据模型 | 0.5 天 | ✅ 完成（文档） |
| 报告生成服务 | 2 天 | ✅ 完成（文档） |
| Word/PDF 导出 | 1.5 天 | ✅ 完成（文档） |
| 前端报告列表 | 1 天 | 待实施 |
| 前端创建向导 | 1.5 天 | 待实施 |
| 前端详情页 | 1 天 | 待实施 |
| 测试与优化 | 1 天 | 待实施 |
| **总计** | **8.5 天** | - |

---

## 六、后续优化

1. **报告缓存**：使用 Redis 缓存生成的报告
2. **流式输出**：前端实时展示 LLM 生成进度
3. **自定义模板**：允许用户自定义报告模板
4. **定时报告**：每日/周自动生成并发送邮件
5. **报告分享**：生成公开链接分享报告

---

**文档版本**：v1.0  
**更新日期**：2026-07-22  
**预计完成时间**：2 周
