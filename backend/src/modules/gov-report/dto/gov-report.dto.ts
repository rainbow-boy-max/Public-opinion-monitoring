import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BriefingStatus, BriefingType } from '../../../database/entities/gov-briefing.entity';
import { InstructionStatus } from '../../../database/entities/leader-instruction.entity';
import {
  MonitorSiteStatus,
  MonitorSiteType,
} from '../../../database/entities/gov-monitor-site.entity';

export class GenerateBriefingDto {
  @IsEnum(['daily', 'weekly', 'special'])
  briefingType: BriefingType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsBoolean()
  useLlm?: boolean;
}

export class QueryBriefingDto {
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'special'])
  briefingType?: BriefingType;

  @IsOptional()
  @IsEnum(['draft', 'generated', 'submitted'])
  status?: BriefingStatus;

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
}

export class SubmitBriefingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  submittedTo: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  webhookUrl?: string;
}

export class ExportBriefingDto {
  @IsEnum(['word', 'pdf'])
  format: 'word' | 'pdf';
}

export class CreateInstructionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  leaderName: string;

  @IsString()
  @MinLength(1)
  instruction: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class QueryInstructionDto {
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed'])
  status?: InstructionStatus;

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
}

export class UpdateInstructionDto {
  @IsOptional()
  @IsEnum(['pending', 'processing', 'completed'])
  status?: InstructionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  handlerName?: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class CreateMonitorSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  siteName: string;

  @IsString()
  @MaxLength(512)
  url: string;

  @IsOptional()
  @IsEnum(['self', 'superior', 'peer', 'policy'])
  siteType?: MonitorSiteType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cssSelector?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  checkFrequency?: number;
}

export class UpdateMonitorSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  siteName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  url?: string;

  @IsOptional()
  @IsEnum(['self', 'superior', 'peer', 'policy'])
  siteType?: MonitorSiteType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cssSelector?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  checkFrequency?: number;

  @IsOptional()
  @IsEnum(['active', 'paused'])
  status?: MonitorSiteStatus;
}

export class QueryMonitorSiteDto {
  @IsOptional()
  @IsEnum(['active', 'paused'])
  status?: MonitorSiteStatus;

  @IsOptional()
  @IsEnum(['self', 'superior', 'peer', 'policy'])
  siteType?: MonitorSiteType;

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
}

export class QueryMonitorChangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId?: number;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

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
}
