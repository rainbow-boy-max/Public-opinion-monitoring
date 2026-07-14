import type { ProviderImplementation, ProviderContext } from '../web-search.types';

export class DuckDuckGoProvider implements ProviderImplementation {
  provider = 'duckduckgo' as const;

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, ctx: ProviderContext): Promise<any[]> {
    const endpoint = 'https://html.duckduckgo.com/html/';
    const attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
      ctx.signal.addEventListener('abort', () => controller.abort());
      const start = Date.now();
      try {
        ctx.emit({
          phase: 'http',
          message: `POST ${endpoint} (attempt ${attempt}/${attempts})`,
          ts: Date.now(),
        });
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
          },
          body: new URLSearchParams({ q: query, kl: '' }).toString(),
          signal: controller.signal,
        });
        ctx.emit({
          phase: 'http',
          message: `${resp.status} ${resp.statusText}`,
          durationMs: Date.now() - start,
          ts: Date.now(),
        });
        if (!resp.ok) continue;
        const html = await resp.text();
        const results = this.parseHtml(html);
        if (results.length > 0) return results;
      } catch (err) {
        ctx.emit({
          phase: 'http',
          level: 'warn',
          message: `attempt ${attempt} failed: ${(err as Error).message}`,
          ts: Date.now(),
        });
      } finally {
        clearTimeout(timeout);
      }
    }
    return this.searchInstantAnswer(query, ctx);
  }

  private parseHtml(html: string, max = 5): any[] {
    const results: any[] = [];
    const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = decodeHtml(m[1]);
      const title = stripHtml(decodeHtml(m[2])).slice(0, 200);
      const snippet = stripHtml(decodeHtml(m[3])).slice(0, 400);
      if (url && title) {
        results.push({
          title,
          url,
          snippet,
          source: 'duckduckgo',
        });
      }
      if (results.length >= max) break;
    }
    return results;
  }

  private async searchInstantAnswer(query: string, ctx: ProviderContext): Promise<any[]> {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(ctx.timeoutMs, 6000));
    ctx.signal.addEventListener('abort', () => controller.abort());
    try {
      ctx.emit({
        phase: 'http',
        message: `GET ${endpoint}`,
        ts: Date.now(),
      });
      const resp = await fetch(endpoint, { signal: controller.signal });
      if (!resp.ok) return [];
      const json: any = await resp.json();
      const results: any[] = [];
      if (json.AbstractText && json.AbstractURL) {
        results.push({
          title: String(json.Heading || query),
          url: String(json.AbstractURL),
          snippet: String(json.AbstractText).slice(0, 400),
          source: 'duckduckgo',
        });
      }
      const topics = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
      for (const t of topics) {
        if (results.length >= 5) break;
        if (t?.FirstURL && t?.Text) {
          results.push({
            title: String(t.Text).split(' - ')[0].slice(0, 200),
            url: String(t.FirstURL),
            snippet: String(t.Text).slice(0, 400),
            source: 'duckduckgo',
          });
        }
      }
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10) || 0));
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
