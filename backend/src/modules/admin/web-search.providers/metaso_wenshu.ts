import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class MetasoWenshuProvider implements ProviderImplementation {
  provider = 'metaso_wenshu' as const;

  isConfigured(ctx: { apiKey: string }): boolean {
    return !!ctx.apiKey;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    if (!this.isConfigured(ctx)) {
      throw new Error('WEB_SEARCH_CONFIG_MISSING:apiKey');
    }
    const url = 'https://metaso.cn/api/v1/search';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
    ctx.signal.addEventListener('abort', () => controller.abort());
    const start = Date.now();
    try {
      ctx.emit({
        phase: 'http',
        message: `POST ${url}`,
        ts: Date.now(),
      });
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          scope: 'web',
          include_summary: true,
          max_results: 10,
        }),
        signal: controller.signal,
      });
      ctx.emit({
        phase: 'http',
        message: `${resp.status} ${resp.statusText}`,
        durationMs: Date.now() - start,
        ts: Date.now(),
      });
      if (!resp.ok) {
        ctx.emit({
          phase: 'parse',
          level: 'warn',
          message: `metaso returned ${resp.status}`,
          ts: Date.now(),
        });
        return [];
      }
      const json: any = await resp.json();
      const items: any[] = Array.isArray(json?.data) ? json.data : [];
      ctx.emit({
        phase: 'parse',
        message: `${items.length} items`,
        ts: Date.now(),
      });
      return items.slice(0, 5).map((r: any) => ({
        title: String(r.title || r.name || '').slice(0, 200),
        url: String(r.url || r.link || ''),
        snippet: String(r.snippet || r.summary || r.content || '').slice(0, 400),
        source: 'metaso_wenshu',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
