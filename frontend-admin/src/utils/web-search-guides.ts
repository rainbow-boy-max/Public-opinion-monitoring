export interface WebSearchProviderGuide {
  value: string;
  label: string;
  builtin: boolean;
  requiresKey: boolean;
  apiKeyPlaceholder: string;
  apiKeyHint: string;
  howToUrl: string;
  howToLabel: string;
  baseUrlHint?: string;
  notes?: string;
}

export const WEB_SEARCH_PROVIDER_GUIDES: Record<string, WebSearchProviderGuide> = {
  duckduckgo: {
    value: 'duckduckgo',
    label: 'DuckDuckGo（免 key）',
    builtin: true,
    requiresKey: false,
    apiKeyPlaceholder: '无需 API Key',
    apiKeyHint: 'DuckDuckGo HTML 端点免 key；沙箱环境会触发 fetch failed。',
    howToUrl: 'https://duckduckgo.com/privacy',
    howToLabel: '使用说明',
    notes: '默认 Provider；数据来自 html.duckduckgo.com；fallback 为 api.duckduckgo.com Instant Answer。',
  },
  brave: {
    value: 'brave',
    label: 'Brave Search API',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'BSA...',
    apiKeyHint: 'Brave Search API 提供 Free Tier：每月 2000 次免费查询。',
    howToUrl: 'https://brave.com/search/api/',
    howToLabel: '申请 Brave API Key',
    baseUrlHint: '默认 https://api.search.brave.com/res/v1/web/search',
  },
  baidu_qianfan: {
    value: 'baidu_qianfan',
    label: '百度千帆 BaiduSearch',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: '百度智能云 AK / 千帆 access_token',
    apiKeyHint:
      '百度千帆的 BaiduSearch 是千帆 AI 搜索内置工具；可使用「千帆 access_token」（推荐）或「智能云 AK/SK 换取的 IAM Token」。',
    howToUrl: 'https://console.bce.baidu.com/qianfan/tools/toolsCenter/57d4e765-8af5-4ec0-8f9b-47075ec349e0/detail',
    howToLabel: '百度千帆控制台 → 工具中心',
    baseUrlHint: 'https://qianfan.baidubce.com/v2/ai_search/web_search',
    notes: '搜索结果中文质量高，适合中文舆情场景。',
  },
  alibaba_dashscope: {
    value: 'alibaba_dashscope',
    label: '阿里云百炼 web_search',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint: '阿里云百炼应用服务市场的「联网内容插件」需应用 API Key。',
    howToUrl: 'https://bailian.console.aliyun.com/',
    howToLabel: '阿里云百炼控制台',
    baseUrlHint: 'https://dashscope.aliyuncs.com/api/v1/apps/web_search',
    notes: '可与通义千问深度配合；计费按调用次数。',
  },
  volcengine_ark: {
    value: 'volcengine_ark',
    label: '火山方舟 联网内容插件',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'ark-...',
    apiKeyHint: '火山方舟大模型服务 API Key；联网内容插件按调用次数计费。',
    howToUrl: 'https://www.volcengine.com/docs/82379/1756990',
    howToLabel: '火山方舟控制台 → 联网内容插件',
    baseUrlHint: 'https://ark.cn-beijing.volces.com/api/v3/web-search',
    notes: '字节豆包系列模型深度支持；与 doubao-pro 等搭配效果最佳。',
  },
  deepseek_web: {
    value: 'deepseek_web',
    label: 'DeepSeek 内置联网',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'sk-...',
    apiKeyHint:
      'DeepSeek 内置联网版模型 `deepseek-chat` 在请求时带 `tools: [{ type: "web_search" }]`，无需单独搜索 API。',
    howToUrl: 'https://platform.deepseek.com/api-docs',
    howToLabel: 'DeepSeek 开放平台',
    notes: 'Key 复用 DeepSeek chat 接口 Key；服务端走 `chat/completions + tools`。',
  },
  boshu_chinese: {
    value: 'boshu_chinese',
    label: '博查中文搜索',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'bocha-...',
    apiKeyHint: '博查 BochaAI 是国内中文搜索 API，按调用次数付费；适合中文语义。',
    howToUrl: 'https://open.bochaai.com/',
    howToLabel: '博查开放平台',
    baseUrlHint: 'https://api.bochaai.com/v1/web-search',
    notes: '搜索结果中文质量优于通用 API。',
  },
  metaso_wenshu: {
    value: 'metaso_wenshu',
    label: '秘塔 AI 搜索',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'metaso-...',
    apiKeyHint: '秘塔 metaso.cn 长文本搜索 API；提供摘要与全文片段。',
    howToUrl: 'https://metaso.cn/',
    howToLabel: '秘塔 AI 搜索',
    baseUrlHint: 'https://metaso.cn/api/v1/search',
  },
  tavily: {
    value: 'tavily',
    label: 'Tavily Search',
    builtin: false,
    requiresKey: true,
    apiKeyPlaceholder: 'tvly-...',
    apiKeyHint: 'Tavily 是为 AI Agent 优化的搜索 API，提供 result-level 元数据。',
    howToUrl: 'https://tavily.com/',
    howToLabel: 'Tavily 控制台',
    baseUrlHint: 'https://api.tavily.com/search',
  },
};