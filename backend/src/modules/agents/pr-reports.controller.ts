import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Res,
  Delete,
  Patch,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrReportsService } from './pr-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsNumber, IsArray, IsIn, ArrayMinSize } from 'class-validator';

class StartReportFromEventDto {
  @IsNumber()
  eventId: number;

  @IsOptional()
  @IsNumber()
  agentId?: number;
}

class StartReportFromTextDto {
  @IsString()
  title: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  agentId?: number;
}

@Controller('pr')
@UseGuards(JwtAuthGuard)
export class PrReportsController {
  constructor(private service: PrReportsService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  async analyze(
    @CurrentUser('id') userId: number,
    @Body() dto: StartReportFromEventDto | StartReportFromTextDto,
  ) {
    if ('eventId' in dto) {
      const r = await this.service.startReportFromEvent(userId, dto.eventId, dto.agentId);
      return { reportId: r.id, status: r.status };
    }
    const r = await this.service.startReportFromText(userId, dto.text, dto.title, dto.agentId);
    return { reportId: r.id, status: r.status };
  }

  @Get('reports/:id')
  async get(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getReport(id, userId);
  }

  @Get('reports')
  async list(
    @CurrentUser('id') userId: number,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.service.listReports(userId, page, pageSize);
  }

  // P1-04: periodic report generation
  @Post('periodic')
  @HttpCode(HttpStatus.ACCEPTED)
  async generatePeriodic(
    @CurrentUser('id') userId: number,
    @Body() dto: { freq: 'daily' | 'weekly'; taskIds: number[] },
  ) {
    const r = await this.service.generatePeriodicReport(userId, dto.freq, dto.taskIds);
    return { reportId: r.id, status: r.status };
  }

  @Get('periodic-schedule')
  async listSchedules(@CurrentUser('id') userId: number) {
    return this.service.listSchedules(userId);
  }

  @Post('periodic-schedule')
  @HttpCode(HttpStatus.CREATED)
  async createSchedule(
    @CurrentUser('id') userId: number,
    @Body() dto: { name: string; freq: 'daily' | 'weekly'; taskIds: number[]; time: string },
  ) {
    return this.service.createSchedule(userId, dto);
  }

  @Patch('periodic-schedule/:id/toggle')
  async toggleSchedule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.toggleSchedule(userId, id);
  }

  @Delete('periodic-schedule/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.deleteSchedule(userId, id);
  }

  @Get('reports/:id/export/:format')
  async exportReport(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('format') format: string,
    @Res() res: Response,
  ) {
    const result = await this.service.exportReport(id, userId, format as 'markdown' | 'pdf' | 'docx');
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  // Admin: list all reports
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminList(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.adminList(page, pageSize, { status, search });
  }

  // Admin: delete report
  @Delete('admin/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminDelete(@Param('id', ParseIntPipe) id: number) {
    await this.service.adminDelete(id);
  }
}
