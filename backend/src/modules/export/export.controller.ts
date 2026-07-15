import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsArray, IsIn, IsInt, ArrayMinSize } from 'class-validator';

class ExportEventsDto {
  @IsInt()
  taskId: number;

  @IsString()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  sentiment?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

class ExportTasksDto {
  @IsString()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json';
}

class ExportStatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  taskIds: number[];

  @IsString()
  @IsIn(['csv', 'json'])
  format: 'csv' | 'json';

  @IsString()
  timeRange: string;
}

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post('events')
  async exportEvents(
    @CurrentUser('id') userId: number,
    @Body() dto: ExportEventsDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportEvents(dto.taskId, userId, dto.format, {
      startDate: dto.startDate,
      endDate: dto.endDate,
      sentiment: dto.sentiment,
      platform: dto.platform,
    });
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  }

  @Post('tasks')
  async exportTasks(
    @CurrentUser('id') userId: number,
    @Body() dto: ExportTasksDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportTasks(userId, dto.format);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  }

  @Post('stats')
  async exportStats(
    @CurrentUser('id') userId: number,
    @Body() dto: ExportStatsDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportStats(userId, dto.taskIds, dto.format, dto.timeRange);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    res.send(result.content);
  }
}
