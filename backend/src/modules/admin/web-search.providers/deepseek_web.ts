import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class DeepseekWebProvider implements ProviderImplementation {
  provider = 'deepseek_web' as const;

  isConfigured(ctx: { apiKey: string }): boolean {
    return !!ctx.apiKey;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    if (!this.isConfigured(ctx)) {
      throw new Error('WEB_SEARCH_CONFIG_MISSING:apiKey');
    }
    const url = 'https://api.deepseek.com/v1/chat/completions';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(ctx.timeoutMs, 15000));
    ctx.signal.addEventListener('abort', () => controller.abort());
    const start = Date.now();
    try {
      ctx.emit({
        phase: 'http',
        message: `POST ${url} (deepseek-chat + web_search tool)`,
        ts: Date.now(),
      });
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: `请基于当前实时信息回答："${query}"。要求引用关键来源。`,
            },
          ],
          tools: [{ type: 'web_search' }],
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
          message: `deepseek returned ${resp.status}`,
          ts: Date.now(),
        });
        return [];
      }
      const json: any = await resp.json();
      const items: any[] =
        Array.isArray(json?.choices?.[0]?.message?.tool_calls?.[0]?.search_results)
          ? json.choices[0].message.tool_calls[0].search_results
          : [];
      ctx.emit({
        phase: 'parse',
        message: `${items.length} results`,
        ts: Date.now(),
      });
      return items.slice(0, 5).map((r: any) => ({
        title: String(r.title || '').slice(0, 200),
        url: String(r.url || ''),
        snippet: String(r.snippet || r.content || '').slice(0, 400),
        source: 'deepseek_web',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
