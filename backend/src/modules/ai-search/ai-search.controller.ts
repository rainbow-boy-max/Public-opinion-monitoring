import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiSearchMonitorService } from './ai-search-monitor.service';

@Controller('ai-search')
@UseGuards(JwtAuthGuard)
export class AiSearchController {
  constructor(private readonly aiSearch: AiSearchMonitorService) {}

  @Get('check')
  async checkKeyword(@Query('keyword') keyword: string) {
    if (!keyword) return this.aiSearch.checkAllKeywords();
    return this.aiSearch.checkKeyword(keyword);
  }

  @Get('check/:keyword')
  async checkKeywordParam(@Param('keyword') keyword: string) {
    return this.aiSearch.checkKeyword(keyword);
  }
}