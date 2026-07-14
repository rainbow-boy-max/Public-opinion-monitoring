import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class AlibabaDashscopeProvider implements ProviderImplementation {
  provider = 'alibaba_dashscope' as const;

  isConfigured(ctx: { apiKey: string }): boolean {
    return !!ctx.apiKey;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    if (!this.isConfigured(ctx)) {
      throw new Error('WEB_SEARCH_CONFIG_MISSING:apiKey');
    }
    const url = 'https://dashscope.aliyuncs.com/api/v1/apps/web_search';
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
          query,
          top_k: 10,
          category: 'general',
          time_range: 'noLimit',
          enable_search_extension: true,
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
          message: `alibaba_dashscope returned ${resp.status}`,
          ts: Date.now(),
        });
        return [];
      }
      const json: any = await resp.json();
      const items: any[] = Array.isArray(json?.output?.results) ? json.output.results : [];
      ctx.emit({
        phase: 'parse',
        message: `${items.length} results`,
        ts: Date.now(),
      });
      return items.slice(0, 5).map((r: any) => ({
        title: String(r.title || '').slice(0, 200),
        url: String(r.url || ''),
        snippet: String(r.snippet || r.content || '').slice(0, 400),
        source: 'alibaba_dashscope',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
