import { IsString, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { PlatformType } from '../../../database/entities/short-video-config.entity';

export class UpdatePlatformConfigDto {
  @IsEnum(PlatformType)
  platform: PlatformType;

  @IsOptional()
  @IsString()
  appKey?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  extraConfig?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateAliyunConfigDto {
  @IsString()
  accessKeyId: string;

  @IsString()
  accessKeySecret: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  ossBucket?: string;

  @IsOptional()
  @IsString()
  ossEndpoint?: string;

  @IsOptional()
  @IsString()
  vcaEndpoint?: string;

  @IsOptional()
  @IsString()
  asrAppKey?: string;

  @IsOptional()
  @IsString()
  asrEndpoint?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;
}
