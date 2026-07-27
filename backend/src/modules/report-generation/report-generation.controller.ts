import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, NotFoundException, StreamableFile, Response } from '@nestjs/common';
import { ReportGenerationService } from './report-generation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReportDto, QueryReportDto } from './dto/report.dto';
import { WordExporter } from './exporters/word-exporter';
import { PdfExporter } from './exporters/pdf-exporter';
import type { Response as ExpressResponse } from 'express';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard)
export class ReportGenerationController {
  constructor(private readonly reportService: ReportGenerationService) {}

  @Post()
  async createReport(@Body() dto: CreateReportDto, @Req() req: any) {
    const report = await this.reportService.createReport({
      reportType: dto.reportType,
      title: dto.title,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      createdBy: req.user.id,
    });
    return { message: '报告创建成功，正在生成中...', data: report };
  }

  @Get()
  async listReports(@Query() query: QueryReportDto) {
    const result = await this.reportService.listReports(query);
    return result;
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    const report = await this.reportService.getReport(+id);
    if (!report) {
      throw new NotFoundException('报告不存在');
    }
    return { data: report };
  }

  @Get(':id/export')
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: 'word' | 'pdf',
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const report = await this.reportService.getReport(+id);
    if (!report || !report.content) {
      throw new NotFoundException('报告不存在或未生成');
    }

    let buffer: Buffer;
    let filename: string;
    let contentType: string;

    if (format === 'word') {
      const exporter = new WordExporter();
      buffer = await exporter.export(report.content, report.title);
      filename = `${report.title}.docx`;
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      const exporter = new PdfExporter();
      buffer = await exporter.export(report.content, report.title);
      filename = `${report.title}.pdf`;
      contentType = 'application/pdf';
    }

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });

    return new StreamableFile(buffer);
  }

  @Delete(':id')
  async deleteReport(@Param('id') id: string) {
    await this.reportService.deleteReport(+id);
    return { message: '报告已删除' };
  }
}
