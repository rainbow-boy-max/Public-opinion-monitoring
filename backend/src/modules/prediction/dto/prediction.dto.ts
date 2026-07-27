import { IsInt, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { RiskLevel } from '../../../database/entities/trend-prediction.entity';

export class CreatePredictionDto {
  @Type(() => Number)
  @IsInt()
  eventId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  horizon: number;
}

export class QueryPredictionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  riskLevel?: RiskLevel;
}
