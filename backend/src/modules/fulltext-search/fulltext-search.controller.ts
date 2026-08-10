import { Controller, Get, Query, Logger } from '@nestjs/common';
import { FulltextSearchService } from './fulltext-search.service';

@Controller('search')
export class FulltextSearchController {
  private readonly logger = new Logger(FulltextSearchController.name);

  constructor(private readonly searchService: FulltextSearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Query('entities') entities?: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { results: [], total: 0 };
    }
    const entityList = entities
      ? entities.split(',').filter(Boolean) as any[]
      : undefined;

    return this.searchService.search(query, {
      limit: Math.min(Number(limit) || 20, 100),
      offset: Number(offset) || 0,
      entities: entityList,
    });
  }
}