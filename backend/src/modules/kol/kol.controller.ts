import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { KolService } from './kol.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('kol')
@UseGuards(JwtAuthGuard)
export class KolController {
  constructor(private kolService: KolService) {}

  @Get('top')
  async getTop(
    @CurrentUser('id') userId: number,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('taskIds') taskIds?: string,
  ) {
    return this.kolService.getTopInfluencers(userId, {
      days: days ? parseInt(days, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      taskIds: taskIds ? taskIds.split(',').map(Number).filter(Boolean) : undefined,
    });
  }

  @Get('mock')
  async getMock() {
    return this.kolService.getMockKols();
  }

  @Get(':author/detail')
  async getDetail(
    @CurrentUser('id') userId: number,
    @Param('author') author: string,
  ) {
    return this.kolService.getKolDetail(decodeURIComponent(author), userId);
  }
}
