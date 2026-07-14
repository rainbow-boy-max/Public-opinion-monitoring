import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  WebSearchService,
  WebSearchConfigMissingError,
  WebSearchDisabledError,
} from './web-search.service';

@Controller('admin/web-search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminWebSearchController {
  constructor(private readonly service: WebSearchService) {}

  @Get('config')
  async getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  @HttpCode(HttpStatus.OK)
  async putConfig(
    @Body()
    body: {
      provider?: 'duckduckgo' | 'brave';
      apiKey?: string;
      maxResults?: number;
      isEnabled?: boolean;
    },
    @CurrentUser('id') operatorId?: number,
  ) {
    try {
      await this.service.saveConfig(body, operatorId ?? null);
      return this.service.getConfig();
    } catch (err) {
      if (err instanceof WebSearchConfigMissingError) {
        return {
          message: err.message,
          errorCode: 'WEB_SEARCH_CONFIG_MISSING',
          field: err.message.split(':')[1] || 'apiKey',
        };
      }
      if (err instanceof WebSearchDisabledError) {
        return {
          message: 'Web search not enabled',
          errorCode: 'WEB_SEARCH_DISABLED',
        };
      }
      throw err;
    }
  }

  @Post('test')
  async test(@Body() body: { query?: string }) {
    const q = (body?.query || 'test').trim();
    try {
      const results = await this.service.search(q);
      return { ok: true, count: results.length, items: results };
    } catch (err) {
      const code =
        err instanceof WebSearchDisabledError
          ? 'WEB_SEARCH_DISABLED'
          : err instanceof WebSearchConfigMissingError
            ? 'WEB_SEARCH_CONFIG_MISSING'
            : 'WEB_SEARCH_FAILED';
      return { ok: false, errorCode: code, message: (err as Error).message };
    }
  }
}