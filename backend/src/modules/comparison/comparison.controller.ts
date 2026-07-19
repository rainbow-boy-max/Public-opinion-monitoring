import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { ComparisonService, ComparisonQuery } from './comparison.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsArray, IsString, IsOptional, IsIn, ArrayMinSize, MaxLength } from 'class-validator';

class ComparisonQueryDto {
  @IsArray()
  @ArrayMinSize(2)
  keywords: string[][];

  @IsOptional()
  @IsArray()
  platforms?: string[];

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsIn(['hour', 'day'])
  interval?: 'hour' | 'day';
}

@Controller('comparison')
@UseGuards(JwtAuthGuard)
export class ComparisonController {
  constructor(private service: ComparisonService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() dto: ComparisonQueryDto) {
    return this.service.compare(dto as ComparisonQuery);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportComparison(@Body() dto: ComparisonQueryDto, @Res() res: Response) {
    const result = await this.service.exportComparison(dto as ComparisonQuery);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }
}
