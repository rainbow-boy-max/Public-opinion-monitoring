import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { WebSearchConfigEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { RedisService } from '../../redis/redis.service';
import { ALL_PROVIDERS, PROVIDER_LABEL } from './web-search.providers';
import {
  SearchLogStep,
  SearchResult,
  WebSearchConfigMissingError,
  WebSearchDisabledError,
  WebSearchProvider,
  WebSearchProviderNotImplementedError,
} from './web-search.types';

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
    provider: string;
    maxResults: number;
    isEnabled: boolean;
    apiKeyMasked: string;
    providers: Array<{
      value: string;
      label: string;
      requiresKey: boolean;
      builtin: boolean;
    }>;
    updatedAt: Date | null;
  }> {
    const c = await this.loadConfigRow();
    const provider = c.provider as WebSearchProvider;
    return {
      provider,
      maxResults: c.maxResults,
      isEnabled: c.isEnabled === 1,
      apiKeyMasked: c.apiKeyEnc ? '***' : '',
      providers: Object.entries(ALL_PROVIDERS).map(([value, impl]) => ({
        value,
        label: PROVIDER_LABEL[value as WebSearchProvider] || value,
        requiresKey: !impl.isConfigured({ apiKey: '' }),
        builtin: value === 'duckduckgo',
      })),
      updatedAt: c.updatedAt,
    };
  }

  async saveConfig(
    input: {
      provider?: string;
      apiKey?: string;
      maxResults?: number;
      isEnabled?: boolean;
    },
    operatorId: number | null,
  ): Promise<void> {
    const current = await this.loadConfigRow();
    const providerInput = (input.provider ?? current.provider) as WebSearchProvider;
    if (!ALL_PROVIDERS[providerInput]) {
      throw new WebSearchProviderNotImplementedError(providerInput);
    }
    const maxResults = Math.max(1, Math.min(10, input.maxResults ?? current.maxResults));
    const isEnabled = input.isEnabled === true ? 1 : 0;
    let apiKeyEnc: string | null = current.apiKeyEnc ?? null;
    if (input.apiKey && input.apiKey !== '***') {
      apiKeyEnc = CryptoUtil.encrypt(input.apiKey);
    }
    const needsKey = !ALL_PROVIDERS[providerInput].isConfigured({ apiKey: '' });
    if (isEnabled === 1 && needsKey && !apiKeyEnc) {
      throw new WebSearchConfigMissingError('apiKey');
    }
    const existing = await this.configRepo.findOne({ where: { id: 1 } });
    if (existing) {
      existing.provider = providerInput;
      existing.apiKeyEnc = apiKeyEnc;
      existing.maxResults = maxResults;
      existing.isEnabled = isEnabled;
      existing.updatedBy = operatorId;
      await this.configRepo.save(existing);
    } else {
      await this.configRepo.save(
        this.configRepo.create({
          id: 1,
          provider: providerInput,
          apiKeyEnc,
          maxResults,
          isEnabled,
          updatedBy: operatorId,
        }),
      );
    }
    await this.clearCache();
  }

  private async loadConfigRow(): Promise<WebSearchConfigEntity> {
    let c = await this.configRepo.findOne({ where: { id: 1 } });
    if (!c) {
      c = await this.configRepo.save(
        this.configRepo.create({
          id: 1,
          provider: 'duckduckgo',
          maxResults: 5,
          isEnabled: 0,
        }),
      );
    }
    return c;
  }

  private async fetchExistingApiKeyEnc(): Promise<string | null> {
    const c = await this.configRepo.findOne({ where: { id: 1 } });
    return c?.apiKeyEnc ?? null;
  }

  async search(query: string): Promise<SearchResult[]> {
    const steps: SearchLogStep[] = [];
    const emit = (s: SearchLogStep) => steps.push(s);
    const items = await this.searchWithLogs(query, emit);
    return items;
  }

  async searchWithLogs(
    query: string,
    emit: (step: SearchLogStep) => void,
  ): Promise<SearchResult[]> {
    const config = await this.getConfig();
    if (!config.isEnabled) {
      emit({ phase: 'error', message: 'Web search disabled', level: 'warn', ts: Date.now() });
      throw new WebSearchDisabledError();
    }
    const trimmed = (query || '').trim().slice(0, 500);
    if (!trimmed) {
      emit({ phase: 'result', message: 'empty query', ts: Date.now() });
      return [];
    }
    emit({ phase: 'validate', message: `provider=${config.provider} query="${trimmed.slice(0, 60)}"`, ts: Date.now() });

    const cacheKey = `web-search:result:${this.hash(trimmed)}:${config.provider}:${config.maxResults}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedResults;
        emit({
          phase: 'result',
          message: `cache hit (${parsed.results.length} items, ${Math.round((Date.now() - parsed.generatedAt) / 1000)}s old)`,
          ts: Date.now(),
        });
        return parsed.results;
      } catch {
        /* ignore */
      }
    }

    const impl = ALL_PROVIDERS[config.provider];
    if (!impl) {
      emit({ phase: 'error', message: `unknown provider ${config.provider}`, level: 'error', ts: Date.now() });
      throw new WebSearchProviderNotImplementedError(config.provider);
    }

    const apiKeyEnc = await this.fetchExistingApiKeyEnc();
    const apiKey = apiKeyEnc ? CryptoUtil.decrypt(apiKeyEnc) : '';
    if (!impl.isConfigured({ apiKey })) {
      emit({
        phase: 'error',
        message: `${config.provider} requires API Key`,
        level: 'error',
        ts: Date.now(),
      });
      throw new WebSearchConfigMissingError('apiKey');
    }

    const abort = new AbortController();
    try {
      const results = await impl.search(trimmed, {
        apiKey,
        timeoutMs: 8000,
        signal: abort.signal,
        emit,
      });
      const sliced = results.slice(0, config.maxResults);
      const payload: CachedResults = { generatedAt: Date.now(), results: sliced };
      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(payload),
          WebSearchService.CACHE_TTL,
        );
        emit({ phase: 'result', message: `cached ${sliced.length} items`, ts: Date.now() });
      } catch (err) {
        this.logger.warn(`web search cache write failed: ${(err as Error).message}`);
      }
      return sliced;
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      emit({ phase: 'error', message, level: 'error', ts: Date.now() });
      throw err;
    } finally {
      try {
        abort.abort();
      } catch {
        /* ignore */
      }
    }
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
}

