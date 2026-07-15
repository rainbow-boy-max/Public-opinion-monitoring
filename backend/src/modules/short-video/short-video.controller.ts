import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ShortVideoService, VideoFilter } from './short-video.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('short-videos')
@UseGuards(JwtAuthGuard)
export class ShortVideoController {
  constructor(private service: ShortVideoService) {}

  @Get('detail/:id')
  async getDetail(
    @CurrentUser('id') _userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getVideoDetail(id);
  }

  @Get(':taskId')
  async listVideos(
    @CurrentUser('id') _userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('platform') platform?: string,
    @Query('sentiment') sentiment?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const filters: VideoFilter = { platform, sentiment, dateFrom, dateTo, page, pageSize };
    return this.service.listVideos(taskId, filters);
  }

  @Get(':taskId/stats')
  async getStats(
    @CurrentUser('id') _userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.service.getVideoStats(taskId);
  }

  @Get(':taskId/top')
  async getTopVideos(
    @CurrentUser('id') _userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('limit') limit = 10,
  ) {
    return this.service.getTopVideos(taskId, limit);
  }

  @Get(':taskId/hashtags')
  async getTrendingHashtags(
    @CurrentUser('id') _userId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.service.getTrendingHashtags(taskId);
  }
}
