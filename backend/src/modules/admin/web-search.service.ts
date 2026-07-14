import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  WebSearchConfigEntity,
  type WebSearchProvider,
} from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { RedisService } from '../../redis/redis.service';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export class WebSearchDisabledError extends Error {
  constructor() {
    super('WEB_SEARCH_DISABLED');
  }
}

export class WebSearchConfigMissingError extends Error {
  constructor(field: string) {
    super(`WEB_SEARCH_CONFIG_MISSING:${field}`);
  }
}

interface CachedResults {
  generatedAt: number;
  results: SearchResult[];
}

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private static readonly CACHE_TTL = 300;

  constructor(
    @InjectRepository(WebSearchConfigEntity)
    private configRepo: Repository<WebSearchConfigEntity>,
    private redisService: RedisService,
  ) {}

  async getConfig(): Promise<{
    provider: WebSearchProvider;
    maxResults: number;
    isEnabled: boolean;
    apiKeyMasked: string;
    updatedAt: Date | null;
  }> {
    let c = await this.configRepo.findOne({ where: { id: 1 } });
    if (!c) {
      c = await this.configRepo.save(
        this.configRepo.create({ id: 1, provider: 'duckduckgo', maxResults: 5, isEnabled: 0 }),
      );
    }
    return {
      provider: c.provider,
      maxResults: c.maxResults,
      isEnabled: c.isEnabled === 1,
      apiKeyMasked: c.apiKeyEnc ? '***' : '',
      updatedAt: c.updatedAt,
    };
  }

  async saveConfig(
    input: { provider?: WebSearchProvider; apiKey?: string; maxResults?: number; isEnabled?: boolean },
    operatorId: number | null,
  ): Promise<void> {
    const current = await this.getConfig();
    const provider = input.provider ?? current.provider;
    const maxResults = Math.max(1, Math.min(10, input.maxResults ?? current.maxResults));
    const isEnabled = input.isEnabled === true ? 1 : 0;
    let apiKeyEnc: string | null = null;
    if (input.apiKey && input.apiKey !== '***') {
      if (provider === 'brave' && input.apiKey.trim().length === 0) {
        throw new WebSearchConfigMissingError('apiKey');
      }
      apiKeyEnc = CryptoUtil.encrypt(input.apiKey);
    } else if (current.apiKeyMasked === '***') {
      apiKeyEnc = await this.fetchExistingApiKeyEnc();
    }
    if (provider === 'brave' && isEnabled === 1 && !apiKeyEnc) {
      throw new WebSearchConfigMissingError('apiKey');
    }
    const existing = await this.configRepo.findOne({ where: { id: 1 } });
    if (existing) {
      existing.provider = provider;
      existing.apiKeyEnc = apiKeyEnc;
      existing.maxResults = maxResults;
      existing.isEnabled = isEnabled;
      existing.updatedBy = operatorId;
      await this.configRepo.save(existing);
    } else {
      await this.configRepo.save(
        this.configRepo.create({
          id: 1,
          provider,
          apiKeyEnc,
          maxResults,
          isEnabled,
          updatedBy: operatorId,
        }),
      );
    }
    await this.clearCache();
  }

  private async fetchExistingApiKeyEnc(): Promise<string | null> {
    const c = await this.configRepo.findOne({ where: { id: 1 } });
    return c?.apiKeyEnc ?? null;
  }

  async search(query: string): Promise<SearchResult[]> {
    const cfg = await this.getConfig();
    if (!cfg.isEnabled) throw new WebSearchDisabledError();
    const trimmed = (query || '').trim().slice(0, 500);
    if (!trimmed) return [];
    const cacheKey = `web-search:result:${this.hash(trimmed)}:${cfg.provider}:${cfg.maxResults}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return (JSON.parse(cached) as CachedResults).results;
      } catch {
        /* ignore */
      }
    }

    const apiKeyEnc = await this.fetchExistingApiKeyEnc();
    let results: SearchResult[];
    if (cfg.provider === 'brave') {
      if (!apiKeyEnc) throw new WebSearchConfigMissingError('apiKey');
      const apiKey = CryptoUtil.decrypt(apiKeyEnc);
      results = await this.searchBrave(trimmed, cfg.maxResults, apiKey);
    } else {
      results = await this.searchDuckDuckGo(trimmed, cfg.maxResults);
    }
    const payload: CachedResults = { generatedAt: Date.now(), results };
    try {
      await this.redisService.set(cacheKey, JSON.stringify(payload), WebSearchService.CACHE_TTL);
    } catch (err) {
      this.logger.warn(`web search cache write failed: ${(err as Error).message}`);
    }
    return results;
  }

  async clearCache(): Promise<void> {
    try {
      const client = (this.redisService as any).client;
      if (!client || typeof client.keys !== 'function') return;
      const keys = await client.keys('web-search:result:*');
      if (keys && keys.length) await client.del(keys);
    } catch {
      /* ignore */
    }
  }

  private hash(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
  }

  private async searchDuckDuckGo(query: string, max: number): Promise<SearchResult[]> {
    const endpoint = 'https://html.duckduckgo.com/html/';
    const attempts = 2;
    const timeoutMs = 8000;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
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
        if (!resp.ok) {
          this.logger.warn(`duckduckgo status ${resp.status}`);
          continue;
        }
        const html = await resp.text();
        const parsed = this.parseDuckDuckGoHtml(html, max);
        if (parsed.length > 0) return parsed;
      } catch (err) {
        this.logger.warn(
          `duckduckgo attempt ${attempt} failed: ${(err as Error).message}`,
        );
      } finally {
        clearTimeout(t);
      }
    }
    return await this.searchDuckDuckGoInstant(query, max);
  }

  private async searchDuckDuckGoInstant(
    query: string,
    max: number,
  ): Promise<SearchResult[]> {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    try {
      const resp = await fetch(endpoint, { signal: controller.signal });
      if (!resp.ok) return [];
      const json = (await resp.json()) as Record<string, any>;
      const results: SearchResult[] = [];
      const abstract = json.AbstractText ? String(json.AbstractText).trim() : '';
      if (abstract && json.AbstractURL) {
        results.push({
          title: String(json.Heading || query).slice(0, 200),
          url: String(json.AbstractURL),
          snippet: abstract.slice(0, 400),
          source: 'duckduckgo',
        });
      }
      const topics = Array.isArray(json.RelatedTopics) ? json.RelatedTopics : [];
      for (const t of topics) {
        if (results.length >= max) break;
        if (t?.FirstURL && t?.Text) {
          results.push({
            title: String(t.Text).split(' - ')[0].slice(0, 200),
            url: String(t.FirstURL),
            snippet: String(t.Text).slice(0, 400),
            source: 'duckduckgo',
          });
        } else if (Array.isArray(t?.Topics)) {
          for (const sub of t.Topics) {
            if (results.length >= max) break;
            if (sub?.FirstURL && sub?.Text) {
              results.push({
                title: String(sub.Text).split(' - ')[0].slice(0, 200),
                url: String(sub.FirstURL),
                snippet: String(sub.Text).slice(0, 400),
                source: 'duckduckgo',
              });
            }
          }
        }
      }
      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(t);
    }
  }

  private parseDuckDuckGoHtml(html: string, max: number): SearchResult[] {
    const results: SearchResult[] = [];
    const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = decodeHtmlEntities(m[1]);
      const title = stripHtml(decodeHtmlEntities(m[2])).slice(0, 200);
      const snippet = stripHtml(decodeHtmlEntities(m[3])).slice(0, 400);
      if (url && title) {
        results.push({ url, title, snippet, source: 'duckduckgo' });
      }
      if (results.length >= max) break;
    }
    if (results.length === 0) {
      const fallbackRe = /class="result__title"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td)/g;
      while ((m = fallbackRe.exec(html)) !== null && results.length < max) {
        const title = stripHtml(decodeHtmlEntities(m[1])).slice(0, 200);
        const snippet = stripHtml(decodeHtmlEntities(m[2])).slice(0, 400);
        if (title) {
          results.push({ url: '', title, snippet, source: 'duckduckgo' });
        }
      }
    }
    return results;
  }

  private async searchBrave(
    query: string,
    max: number,
    apiKey: string,
  ): Promise<SearchResult[]> {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5500);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Subscription-Token': apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!resp.ok) {
        this.logger.warn(`brave status ${resp.status}`);
        return [];
      }
      const json = (await resp.json()) as { web?: { results?: any[] } };
      const arr = json?.web?.results ?? [];
      return arr.slice(0, max).map((r: any) => ({
        title: String(r.title || '').slice(0, 200),
        url: String(r.url || ''),
        snippet: String(r.description || '').slice(0, 400),
        source: 'brave',
      }));
    } catch (err) {
      this.logger.warn(`brave fetch failed: ${(err as Error).message}`);
      return [];
    } finally {
      clearTimeout(t);
    }
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCharCode(parseInt(n, 10));
      } catch {
        return '';
      }
    });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}