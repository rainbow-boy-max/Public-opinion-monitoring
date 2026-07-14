import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  WebSearchService,
} from './web-search.service';
import {
  SearchLogStep,
  WebSearchConfigMissingError,
  WebSearchDisabledError,
  WebSearchProviderNotImplementedError,
} from './web-search.types';

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
      provider?: string;
      apiKey?: string;
      maxResults?: number;
      isEnabled?: boolean;
    },
    @CurrentUser('id') operatorId?: number,
  ) {
    try {
      await this.service.saveConfig(body as any, operatorId ?? null);
      return this.service.getConfig();
    } catch (err: any) {
      if (err instanceof WebSearchConfigMissingError) {
        return {
          message: err.message,
          errorCode: 'WEB_SEARCH_CONFIG_MISSING',
          field: (err.message.split(':')[1] || 'apiKey') as string,
        } as any;
      }
      if (err instanceof WebSearchProviderNotImplementedError) {
        return {
          message: err.message,
          errorCode: 'WEB_SEARCH_PROVIDER_NOT_IMPLEMENTED',
        } as any;
      }
      throw err;
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async test(@Body() body: { query?: string; provider?: string }) {
    const q = (body?.query || 'test').trim();
    try {
      const items = await this.service.search(q);
      return { ok: true, count: items.length, items };
    } catch (err: any) {
      const code =
        err instanceof WebSearchDisabledError
          ? 'WEB_SEARCH_DISABLED'
          : err instanceof WebSearchConfigMissingError
            ? 'WEB_SEARCH_CONFIG_MISSING'
            : 'WEB_SEARCH_FAILED';
      return { ok: false, errorCode: code, message: (err as Error).message };
    }
  }

  @Post('test-stream')
  async testStream(
    @Body() body: { query?: string; provider?: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const write = (event: string, data: any) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        /* ignore */
      }
    };
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      } catch {
        /* ignore */
      }
    }, 25_000);
    const start = Date.now();
    const q = (body?.query || 'test').trim();
    try {
      const items = await this.service.searchWithLogs(q, (s: SearchLogStep) => {
        write('step', s);
      });
      write('result', { items });
      write('done', { ok: true, count: items.length, totalDurationMs: Date.now() - start });
    } catch (err: any) {
      write('step', {
        phase: 'error',
        level: 'error',
        message: (err as Error)?.message || String(err),
        ts: Date.now(),
      });
      write(
        'error',
        {
          message: (err as Error)?.message || String(err),
          errorCode:
            err instanceof WebSearchDisabledError
              ? 'WEB_SEARCH_DISABLED'
              : err instanceof WebSearchConfigMissingError
                ? 'WEB_SEARCH_CONFIG_MISSING'
                : err instanceof WebSearchProviderNotImplementedError
                  ? 'WEB_SEARCH_PROVIDER_NOT_IMPLEMENTED'
                  : 'WEB_SEARCH_FAILED',
          totalDurationMs: Date.now() - start,
        },
      );
    } finally {
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
}
