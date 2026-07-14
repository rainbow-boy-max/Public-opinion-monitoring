import { DuckDuckGoProvider } from './duckduckgo';
import { BraveProvider } from './brave';
import { BaiduQianfanProvider } from './baidu_qianfan';
import { AlibabaDashscopeProvider } from './alibaba_dashscope';
import { VolcengineArkProvider } from './volcengine_ark';
import { DeepseekWebProvider } from './deepseek_web';
import { BoshuChineseProvider } from './boshu_chinese';
import { MetasoWenshuProvider } from './metaso_wenshu';
import { TavilyProvider } from './tavily';
import type { ProviderImplementation, WebSearchProvider } from '../web-search.types';

export const ALL_PROVIDERS: Record<WebSearchProvider, ProviderImplementation> = {
  duckduckgo: new DuckDuckGoProvider(),
  brave: new BraveProvider(),
  baidu_qianfan: new BaiduQianfanProvider(),
  alibaba_dashscope: new AlibabaDashscopeProvider(),
  volcengine_ark: new VolcengineArkProvider(),
  deepseek_web: new DeepseekWebProvider(),
  boshu_chinese: new BoshuChineseProvider(),
  metaso_wenshu: new MetasoWenshuProvider(),
  tavily: new TavilyProvider(),
};

export const PROVIDER_LABEL: Record<WebSearchProvider, string> = {
  duckduckgo: 'DuckDuckGo（免 key）',
  brave: 'Brave Search API',
  baidu_qianfan: '百度千帆 BaiduSearch',
  alibaba_dashscope: '阿里云百炼 web_search',
  volcengine_ark: '火山方舟 联网内容插件',
  deepseek_web: 'DeepSeek 内置联网',
  boshu_chinese: '博查中文搜索',
  metaso_wenshu: '秘塔 AI 搜索',
  tavily: 'Tavily Search',
};

export const PROVIDER_KEY_PLACEHOLDER: Partial<Record<WebSearchProvider, string>> = {
  brave: 'BSA...',
  baidu_qianfan: '百度智能云 AK 或 access_token',
  alibaba_dashscope: 'sk-... DashScope API Key',
  volcengine_ark: 'ark-...',
  deepseek_web: 'sk-... DeepSeek',
  boshu_chinese: 'bocha-...',
  metaso_wenshu: 'metaso-...',
  tavily: 'tvly-...',
};
