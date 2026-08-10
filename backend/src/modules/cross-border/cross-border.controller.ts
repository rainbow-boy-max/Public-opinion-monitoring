import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CrossBorderMonitorService } from './cross-border-monitor.service';

@Controller('cross-border')
@UseGuards(JwtAuthGuard)
export class CrossBorderController {
  constructor(private readonly monitor: CrossBorderMonitorService) {}

  @Get('platforms')
  getPlatforms() {
    return { platforms: this.monitor.getPlatforms() };
  }

  @Post('search')
  async search(
    @Body() body: { keywords: string[]; platforms?: string[] },
  ) {
    return this.monitor.searchOverseas(body.keywords, body.platforms);
  }

  @Post('translate')
  async translate(@Body() body: { text: string; targetLang?: string }) {
    return this.monitor.translate(body.text, body.targetLang || 'zh');
  }
}