import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class BraveProvider implements ProviderImplementation {
  provider = 'brave' as const;

  isConfigured(ctx: { apiKey: string }): boolean {
    return !!ctx.apiKey;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    if (!this.isConfigured(ctx)) {
      throw new Error('WEB_SEARCH_CONFIG_MISSING:apiKey');
    }
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
    ctx.signal.addEventListener('abort', () => controller.abort());
    const start = Date.now();
    try {
      ctx.emit({
        phase: 'http',
        message: `GET ${url.replace(/q=[^&]+/, 'q=' + encodeURIComponent(query))}`,
        ts: Date.now(),
      });
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Subscription-Token': ctx.apiKey,
          Accept: 'application/json',
        },
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
          message: `brave returned ${resp.status}`,
          ts: Date.now(),
        });
        return [];
      }
      const json: any = await resp.json();
      const arr = Array.isArray(json?.web?.results) ? json.web.results : [];
      ctx.emit({
        phase: 'parse',
        message: `${arr.length} results`,
        ts: Date.now(),
      });
      return arr.slice(0, 5).map((r: any) => ({
        title: String(r.title || '').slice(0, 200),
        url: String(r.url || ''),
        snippet: String(r.description || '').slice(0, 400),
        source: 'brave',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
