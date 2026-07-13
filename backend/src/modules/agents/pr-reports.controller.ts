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
} from '@nestjs/common';
import { Response } from 'express';
import { PrReportsService } from './pr-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsNumber } from 'class-validator';

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
}
