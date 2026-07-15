import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { HotTopicsService } from './hot-topics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class HotTopicsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  windowHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minMentions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  topN?: number;
}

@Controller('hot-topics')
@UseGuards(JwtAuthGuard)
export class HotTopicsController {
  constructor(private readonly hotTopicsService: HotTopicsService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: HotTopicsQueryDto) {
    return this.hotTopicsService.getHotTopics(user.id, {
      windowHours: query.windowHours,
      minMentions: query.minMentions,
      topN: query.topN,
    });
  }

  @Get('export')
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="hot-topics.json"')
  async export(@CurrentUser() user: CurrentUserPayload, @Query() query: HotTopicsQueryDto) {
    return this.hotTopicsService.getHotTopics(user.id, {
      windowHours: query.windowHours,
      minMentions: query.minMentions,
      topN: (query.topN ?? 50),
    });
  }

  @Get(':topicId')
  async detail(@CurrentUser() user: CurrentUserPayload, @Param('topicId') topicId: string) {
    return this.hotTopicsService.getTopicDetail(user.id, topicId);
  }
}
