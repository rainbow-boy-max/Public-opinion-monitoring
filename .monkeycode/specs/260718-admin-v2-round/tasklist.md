# 实施计划：admin-v2-round（260718）

> 基线：`.monkeycode/specs/260718-admin-v2-round/requirements.md` + `design.md`
> 优先级：REQ-6 仪表盘 SSE > REQ-7 LLM 崩溃 > REQ-8 KB 可见 > REQ-10 测试日志 > REQ-9 Provider 矩阵

---

## 1. REQ-6 仪表盘 SSE「实时连接断开」修复

- [ ] 1. 后端：JWT Guard 改造支持 `?token=` query 兜底
  - `backend/src/common/guards/jwt-auth.guard.ts` 先读 cookie，再 Authorization header，最后 `req.query.token`
  - 401/403 时 `response.setHeader('X-WebSearch-Error', '...')` 让 SSE 立即关闭
  - 关联：REQ-6.2

- [ ] 2. 后端：DashboardController SSE 端点补 25s 心跳 + 鉴权失败立即 close
  - `dashboard.service.ts` 的 streamRecentActivities 加 `interval(25_000)` 发 `event: ping`
  - 连接建立时先通过 `authenticate()` 校验；失败 close
  - 关联：REQ-6.4

- [ ] 3. 前端：`useRecentActivities` 接 SSE error 事件 + token 入 query
  - `composables/useRecentActivities.ts`：`new EventSource(url + (token ? '?token=' : ''), { withCredentials: true })`
  - 监听 `error` 事件：状态置 disconnected；5 s 后重连；throttle 最大 1 次/5s
  - 5xx / 401 / 403 不自动重连（弹「请重新登录」）
  - 关联：REQ-6.3 / CP-1 / CP-2

## 4. REQ-7 LLM 配置页容错

- [ ] 4. 前端：`LlmModelsManagementPage` 移除 `el-tabs :lazy`
  - 已实施于 260716。继续核对
  - 关联：REQ-7.5

- [ ] 5. 前端：edit 对话框能力校验 + 必填校验
  - `editForm.vision / reasoning / webSearch` 默认 false；与 maxTokens 联动 disable 保存按钮直到 displayName+model+baseUrl 都不空
  - 关联：REQ-7.4

- [ ] 6. 后端：`LlmModelsService.list / getOne` 缺失 capabilities 时兜底默认 `{vision:false, reasoning:false, webSearch:false}`
  - serialize 已实施。继续核对 applyDto
  - 关联：REQ-7.3

- [ ] 7. 检查点：dev console 0 红（连切 7 次厂商 tab）
  - 关联：CP-3 / CP-4

## 8. REQ-8 知识库可见性

- [ ] 8. 后端：`KnowledgeBasesService.listAvailableKbs` 输出 id 强转 `Number(k.id)`
  - 已实施于 260716
  - 关联：REQ-8.2 / CP-5

- [ ] 9. 前端：`AgentDetailPage.vue` mount 时无条件加载 KB list
  - `onMounted` 与 `onTabClick('kb')` 都调 `loadAllKbs()`，不再依赖 KB tab 切换
  - `loadAllKbs()` 中 `Number(kb.id)` 兜底
  - `loadAgentKbBindings` 同样 `Number()` ids
  - 关联：REQ-8.1 / REQ-8.4

## 11. REQ-10 Web Search 测试实时日志（SSE）

- [ ] 11. 后端：`WebSearchService.search` 改造为 AsyncIterable<LogEvent>
  - 增加 `searchWithLogs(query, onLog): Promise<SearchResult[]>`；onLog 推送 step 事件
  - 各 provider 注入 AbortController / 超时上报

- [ ] 12. 后端：`WebSearchController.testStream` SSE 端点
  - `POST /admin/web-search/test-stream` SSE 返回：
    - `event: step` 每个阶段
    - `event: result` 最终结果
    - `event: done` 关闭
    - `event: error` 失败
  - 25 s 心跳

- [ ] 13. 前端：`composables/useWebSearchTest.ts`
  - 用 EventSource POST 不支持 → 用 `fetch` + `ReadableStream` 读 `event:` 块
  - 解析 SSE 推流到 reactive steps 数组

- [ ] 14. 前端：`WebSearchConfigPage.vue` 改为 SSE 测试
  - 把现有同步 `el-card` 改为 `el-timeline` 实时日志
  - 「测试」按钮创建 EventSource，全程实时渲染；done 后自动断开

## 15. REQ-9 多 Provider 矩阵 + 模型原生工具调用

- [ ] 15. 后端：WebSearchProvider 枚举扩到 9 种
  - 更新 entity enum + migration `1700000060000-ExpandWebSearchProviders`
  - 关联：REQ-9.1

- [ ] 16. 后端：8 个新 provider 实现（参考 DuckDuckGoProvider 模板）
  - `baidu_qianfan`: 千帆 OpenAPI https://qianfan.baidubce.com/v2/services/search
  - `alibaba_dashscope`: 百炼 web_search via dashscope SDK or REST
  - `volcengine_ark`: 火山方舟 bot-as-a-service 的 web_search plugin
  - `deepseek_web`: deepseek-chat model with `tools=[{type:'web_search'}]`
  - `boshu_chinese`: https://api.bochaai.com/v1/web-search
  - `metaso_wenshu`: https://metaso.cn/api/v1/search
  - `tavily`: https://api.tavily.com/search
  - 每个 provider 都需要：AES-256-CBC 加密 key；5 s 超时；retry 1 次；错误结构化
  - 关联：REQ-9.1

- [ ] 17. 后端：`WebSearchRouter.route(agent, ctx)` 决策器
  - 优先：模型 capabilities.toolSupported.webSearch=true → `native_tool` 路径
  - 否则：provider 启用 → `provider` 路径
  - 否则：`disabled` + warnings

- [ ] 18. 后端：`LLM_MODEL_TOOLS` catalog + `LlmModelsService.inferToolCapabilities`
  - 已知 provider/model 推断（OpenAI `gpt-4o-search-preview`、Gemini-1.5 with search、Qwen-Search、Kimi builtin 等）
  - 未知模型不预设，返回 `false`
  - 关联：REQ-9.5

- [ ] 19. 后端：`LlmRouterService` 支持工具调用循环
  - `chat(messages, options)` 接 `tools?: ToolDef[]`
  - 当 LLM 返回 `tool_calls` 时再次调用 provider 把 tool 结果注入后追问
  - 递归上限 2 次

- [ ] 20. 后端：`AgentsService.chat` 接 WebSearchRouter
  - 用 router.route(agent, ctx) 选路径
  - native_tool 路径：直接传给 llmRouterService.chat({ tools: [webSearchTool] })，LLM 自决
  - provider 路径：先 webSearchService.search(...) 拿结果塞 system message，再走 chat
  - 返回 `source: 'native_tool' | 'provider' | 'disabled'` 与 `warnings[]`

- [ ] 21. 后端：`llm_models.capabilities` 扩展 schema
  - 现有 `{ vision, reasoning, webSearch }` 不变；新增 `toolSupported?: { webSearch?: boolean }`
  - migration 加 toolSupported JSON 字段

- [ ] 22. 前端：`LlmModelsManagementPage` 编辑对话框显示原生能力图标
  - 当 model.capabilities.toolSupported.webSearch=true 时，dialog 自动勾选 webSearch checkbox 并显示「🛜 模型原生支持」徽章
  - 否则保持手动状态

- [ ] 23. 前端：`WebSearchConfigPage` 提供商 select 补全 9 项
  - 使用 `getConfig` 接口返回 provider 列表
  - apiKey 输入框 placeholder 切换：「千帆应用 API Key」「DashScope API Key」「Brave API Key」等

- [ ] 24. 前端：AgentDetailPage 模型 dropdown 标注原生能力
  - 模型选项中显示「🛜 native web」徽章
  - 选带徽章的模型时 capabilities.webSearch=true 自动勾
  - 关联：REQ-9.7

## 25. 最终

- [ ] 25. 跑 migration (1700000060000) 验证 schema
- [ ] 26. 后端 nest start --watch 自动 reload；手动 curl 回归 10 条主路径
- [ ] 27. 全部 8 条 CP 验证（CP-1 ~ CP-8）
- [ ] 28. git commit & 推 spec + 代码
- [ ]* 28.1 单元测试（WebSearchRouter、WebSearch Providers）
- [ ]* 28.2 e2e Playwright 烟测：登录 → dashboard SSE → /llm-models → /agents/:id → /config/web-search