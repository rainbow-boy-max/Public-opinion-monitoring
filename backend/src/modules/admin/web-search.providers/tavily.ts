import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class TavilyProvider implements ProviderImplementation {
  provider = 'tavily' as const;

  isConfigured(ctx: { apiKey: string }): boolean {
    return !!ctx.apiKey;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    if (!this.isConfigured(ctx)) {
      throw new Error('WEB_SEARCH_CONFIG_MISSING:apiKey');
    }
    const url = 'https://api.tavily.com/search';
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: ctx.apiKey,
          query,
          max_results: 10,
          search_depth: 'basic',
          include_answer: false,
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
          message: `tavily returned ${resp.status}`,
          ts: Date.now(),
        });
        return [];
      }
      const json: any = await resp.json();
      const items: any[] = Array.isArray(json?.results) ? json.results : [];
      ctx.emit({
        phase: 'parse',
        message: `${items.length} results`,
        ts: Date.now(),
      });
      return items.slice(0, 5).map((r: any) => ({
        title: String(r.title || '').slice(0, 200),
        url: String(r.url || ''),
        snippet: String(r.content || '').slice(0, 400),
        source: 'tavily',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
