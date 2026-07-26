import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ReportGenerationService } from './report-generation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReportDto, QueryReportDto } from './dto/report.dto';

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
      return { message: '报告不存在' };
    }
    return { data: report };
  }

  @Delete(':id')
  async deleteReport(@Param('id') id: string) {
    await this.reportService.deleteReport(+id);
    return { message: '报告已删除' };
  }
}
