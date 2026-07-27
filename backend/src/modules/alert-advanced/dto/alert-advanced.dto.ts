import { IsEnum, IsOptional, IsArray, IsObject, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AlertLevel, AlertChannel } from '../../../database/entities/alert-config.entity';
import { AlertStatus } from '../../../database/entities/alert-record.entity';

export class UpdateAlertConfigDto {
  @IsEnum(AlertLevel)
  alertLevel: AlertLevel;

  @IsArray()
  @IsEnum(AlertChannel, { each: true })
  enabledChannels: AlertChannel[];

  @IsOptional()
  @IsObject()
  quietHours?: { start: string; end: string } | null;

  @IsObject()
  recipients: {
    phone?: string[];
    email?: string[];
    wechat?: string[];
    dingtalk?: string[];
  };

  @IsObject()
  triggerConditions: {
    readCount?: number;
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
    sentiment?: string[];
    keywords?: string[];
  };

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class QueryAlertRecordsDto {
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
  @IsEnum(AlertLevel)
  alertLevel?: AlertLevel;

  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;
}

export class ConfirmAlertDto {
  @IsOptional()
  feedback?: string;
}
