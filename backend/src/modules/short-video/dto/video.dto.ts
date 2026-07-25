import { IsString, IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { VideoPlatform } from '../../../database/entities/short-video.entity';

export class CreateVideoDto {
  @IsEnum(VideoPlatform)
  platform: VideoPlatform;

  @IsString()
  platformVideoId: string;

  @IsString()
  videoUrl: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  authorId: string;

  @IsString()
  authorName: string;

  @IsString()
  @IsOptional()
  authorAvatar?: string;

  @IsOptional()
  publishTime?: Date;

  @IsInt()
  @IsOptional()
  likeCount?: number;

  @IsInt()
  @IsOptional()
  commentCount?: number;

  @IsInt()
  @IsOptional()
  shareCount?: number;

  @IsInt()
  @IsOptional()
  playCount?: number;

  @IsInt()
  @IsOptional()
  duration?: number;
}

export class QueryVideoDto {
  @IsOptional()
  @IsEnum(VideoPlatform)
  platform?: VideoPlatform;

  @IsOptional()
  @IsString()
  keyword?: string;

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
