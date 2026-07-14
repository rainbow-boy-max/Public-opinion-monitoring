export type WebSearchProvider =
  | 'duckduckgo'
  | 'brave'
  | 'baidu_qianfan'
  | 'alibaba_dashscope'
  | 'volcengine_ark'
  | 'deepseek_web'
  | 'boshu_chinese'
  | 'metaso_wenshu'
  | 'tavily';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SearchLogStep {
  phase: 'validate' | 'http' | 'parse' | 'result' | 'done' | 'error';
  message: string;
  durationMs?: number;
  level?: 'info' | 'warn' | 'error';
  ts: number;
}

export interface ProviderContext {
  apiKey: string;
  timeoutMs: number;
  signal: AbortSignal;
  emit(step: SearchLogStep): void;
}

export interface ProviderImplementation {
  provider: WebSearchProvider;
  isConfigured(ctx: { apiKey: string }): boolean;
  search(query: string, ctx: ProviderContext): Promise<SearchResult[]>;
}

export class WebSearchDisabledError extends Error {
  readonly warning = 'WEB_SEARCH_DISABLED';
  constructor() {
    super('WEB_SEARCH_DISABLED');
  }
}

export class WebSearchConfigMissingError extends Error {
  readonly warning: string;
  constructor(field: string) {
    super(`WEB_SEARCH_CONFIG_MISSING:${field}`);
    this.warning = `WEB_SEARCH_CONFIG_MISSING:${field}`;
  }
}

export class WebSearchProviderNotImplementedError extends Error {
  readonly warning = 'WEB_SEARCH_PROVIDER_NOT_IMPLEMENTED';
  constructor(provider: string) {
    super(`WEB_SEARCH_PROVIDER_NOT_IMPLEMENTED:${provider}`);
  }
}
