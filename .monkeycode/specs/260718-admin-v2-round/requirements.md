# Requirements Document — 管理端第二轮商用整改

Feature: admin-v2-round
Spec Version: 260718
Status: Draft
Owner: Admin Frontend Team
Updated: 2026-07-14

---

## 1. Introduction

承接 260716 之后用户反馈的 5 项问题：

| # | 名称 | 性质 |
|---|---|---|
| REQ-6 | 仪表盘最近活动显示「实时连接断开」 | SSE 鉴权与生命周期 |
| REQ-7 | 管理端 LLM 大模型配置点击后页面崩溃 | 运行时容错 |
| REQ-8 | AI 知识库已就绪但 AI 智能体详情页未显示 | 列表加载时机 |
| REQ-9 | Web Search 多 Provider 对接 + 大模型自带能力 | 商用能力扩展 |
| REQ-10 | Web Search 测试实时日志展示 | 调试体验 |

每项均按 EARS / INCOSE 规范表述，"支持商用"为合格线：零控制台报错、可观测、可回滚、可国际化。

---

## 2. Glossary

| 术语 | 含义 |
|---|---|
| SSE | Server-Sent Events，长连接服务端单向推送 |
| EventSource | 浏览器原生 SSE 客户端 API |
| Provider | Web Search 后端来源（duckduckgo / brave / 百度千帆 / 阿里云百炼 / 火山方舟 / DeepSeek / 博查 / Metaso / Tavily 等） |
| Capability | 大模型能力声明：vision / reasoning / webSearch |
| Dashboard | 管理端 `/dashboard` 路由 |
| Modal Stable | Vue diff 算法 vnode.flag 之 STABLE |
| Dashboard SSE | `/api/admin/dashboard/recent-activities/stream` 端点 |

---

## 3. Requirements

### REQ-6 最近活动实时流修复

**User Story**: AS 管理员, I WANT 仪表盘上的「最近活动」持续显示新事件而不出现"实时连接断开", SO THAT 我对平台动态有持续感知。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/dashboard`, THE 后端 SHALL 通过持久的 EventSource 连接订阅 `/api/admin/dashboard/recent-activities/stream`，身份通过 HTTP-only Cookie 或 `?token=` query 注入而非 client-side 自定义 header。
2. THE 后端 SHALL 在 JWT 鉴权未通过（401 / 403）时返回结构化错误并让客户端立即显示「未授权」而非无限 retry。
3. THE 前端 `useRecentActivities` SHALL 在收到 `error` 事件时显示「实时已断开 · 每 5 秒重连」并在 5 s 后自动重新连接，且不允许 throttle 风暴（最大 1 次连接尝试 / 5s）。
4. THE 服务端 SHALL 在每 25 秒发送心跳（`event: ping`），连续 2 次心跳超时则主动关闭连接。
5. THE 控制台 SHALL 不再出现 `EventSource's readyState isn't OPEN` 类 warning。

**Correctness Properties**：
- CP-1：连续保持 dashboard 页面 5 分钟内 readyState 始终 OPEN
- CP-2：后端主动断开时，客户端 ≤ 6 s 内自动重连成功

---

### REQ-7 LLM 模型管理页稳定容错

**User Story**: AS 管理员, I WANT 进入 `/llm-models` 永不发生未捕获异常崩溃, SO THAT 我能持续配置提供商。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/llm-models`, THE 页面 SHALL 在 ≤ 800 ms 内完成首屏渲染，控制台 0 红，Network 无 5xx。
2. IF 任意 `<el-dropdown>` 子组件在 patch 阶段抛错, THE app.config.errorHandler SHALL 接住并把堆栈渲染到 `#app` 节点（不再出现纯色空白）。
3. THE 后端 `GET /api/admin/llm-models` SHALL 在 capabilities 字段缺失时返回 `{ vision: false, reasoning: false, webSearch: false }` 默认值而非 500。
4. THE 前端 edit 对话框 SHALL 在 vision / reasoning / webSearch 切换时禁用保存按钮直到所有必填字段填齐，并实时校验 `displayName + model + baseUrl` 三件套。
5. THE 任何 `el-tabs` 与 `el-dropdown` 共存的列表组件 SHALL 移除 `:lazy="true"` 以避免 EP2.14.3 el-dropdown unmount/restore race。

**Correctness Properties**：
- CP-3：连续切 7 次厂商 tab 无 unhandled rejection
- CP-4：连续打开/关闭编辑对话框 5 次无栈堆叠

---

### REQ-8 知识库可见性统一

**User Story**: AS 管理员, I WANT 在「智能体编辑」页面的知识库 tab 中看到所有 `ready` 的知识库, SO THAT 我能把它们关联到智能体上。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/agents/new` 或 `/agents/:id`, THE 智能体详情页 SHALL 在 mount 时立即调用 `GET /api/admin/knowledge/available`，不论是否进入「知识库」Tab。
2. THE 后端 SHALL 在 `listAvailableKbs` 中确保 `id` 字段为 `number`（不是 bigint 序列化为字符串的 `"1"`）。
3. WHEN 智能体的 `kbEnabled=true`, THE 「知识库」Tab SHALL 显示 ≥ 1 个 ready 知识库选项；当 DB 中无任何 ready KB 时 SHALL 显式空态："📭 尚无 ready 知识库，去 /knowledge 创建"。
4. THE 前端 SHALL 防御性把后端 `id` 转 `Number` 并对 `Array.isArray` 失效时回退 `[]`。

**Correctness Properties**：
- CP-5：编辑存在 KB 关联的智能体，刷新后选项保持已选状态

---

### REQ-9 多 Provider Web Search + 大模型自带能力

**User Story**: AS 管理员, I WANT 在「Web 搜索配置」页面选自国内外多种搜索服务；同时当某大模型自带联网能力时, I WANT 自动用模型自带能力而不调用外部 Provider, SO THAT 体验更准确 / 更省成本 / 更可控。

**Acceptance Criteria**:

1. THE 后端 WebSearchService SHALL 支持以下 Provider，每种具备独立实现：

| Provider | 鉴权 | 备注 |
|---|---|---|
| `duckduckgo` | 无 | 免费默认；HTML 抓取 + Instant Answer fallback |
| `brave` | API Key | Brave Search API |
| `baidu_qianfan` | API Key (千帆 AK/SK) | 百度搜索（BaiduSearch Skill MCP + OpenAPI） |
| `alibaba_dashscope` | API Key (DashScope) | 阿里云百炼 web_search |
| `volcengine_ark` | API Key (方舟) | 火山方舟联网内容插件 |
| `deepseek_web` | API Key (DeepSeek) | DeepSeek 内置 `-web` 联网版本（`deepseek-chat` 自动联网） |
| `boshu_chinese` | API Key (博查) | 中文检索，比 DDG 更准 |
| `metaso_wenshu` | API Key (秘塔) | metaso 长文本搜索 |
| `tavily` | API Key (Tavily) | 海外通用 |

2. THE Provider 配置表单 SHALL 提供 provider select / API Key / maxResults / isEnabled，KEY 字段用 AES-256-CBC 加密。
3. WHEN 管理员在 Web 搜索配置中未启用任何 Provider, THE 智能体的 `webSearch=true` 调用 SHALL 退化为「模型自带工具调用」路径。
4. WHEN 主用模型在 LLM 编辑对话框中已勾选 webSearch=true, THE 智能体 chat 路径 SHALL 优先调用模型 provider 原生 web tool（OpenAI tools / Gemini function_calling / Qwen search / Kimi builtin），不再额外走「Web 搜索服务」。
5. THE 后端 SHALL 新增 `LLM_MODEL_TOOLS` 推断：若主用模型 `provider` 是 openai / dashscope / ark / moonshot / zhipu / siliconflow / kimi 等，预设支持 `web_search` tool 的模型名；调用 LLM 时通过 `tools` 参数注入，模型返回 `web_search` tool_calls 时由后端真去解析并把结果注入对话后再次调用。
6. THE 后端新增 `WebSearchRouter`：
   - `agent.capabilities.webSearch=true` && 模型支持 tool → 走 tool_call 路径
   - 否则若 `webSearchProviderEnabled` → 走 Provider 调用
   - 否则返回 `warnings:['WEB_SEARCH_DISABLED']` 且不调用

7. THE 智能体详情页 LLM 模型选项 SHALL 在 dropdown 中用图标标明模型是否原生支持 web（🛜 vs 🔗），点击「自动判断」按钮触发：
   - 选中模型 capabilities.webSearch → 立即勾上
   - 否则弹 ElMessageBox「该模型未声明能力，请确认是否手动勾选」并附跳转链接。

**Correctness Properties**：
- CP-6：选 OpenAI gpt-4o 时，dashscope/external provider 都会被跳过，chat 直接调 LLM native tool
- CP-7：未配置任何 Provider 时，agent.capabilities.webSearch=true 的 chat 调用时返回 warnings 包含 'WEB_SEARCH_DISABLED'

---

### REQ-10 Web Search 测试实时日志展示

**User Story**: AS 管理员, I WANT 在「Web 搜索配置」页面点「测试」按钮时看到实时刷新的日志输出（耗时、URL、响应、解析结果），SO THAT 我能快速定位问题。

**Acceptance Criteria**:

1. THE 后端 SHALL 提供 `POST /api/admin/web-search/test-stream` SSE 端点，以 SSE 流式返回每个步骤：
   - `event: step\ndata: { phase: 'validate', message: '...' }`
   - `event: step\ndata: { phase: 'http', message: 'GET https://...', durationMs: 230 }`
   - `event: step\ndata: { phase: 'parse', message: '5 results parsed' }`
   - `event: result\ndata: { items: [...] }`
   - `event: done\ndata: { ok: true, totalDurationMs: 1234 }` 或 `event: error\ndata: { message: '...' }`

2. THE 前端 SHALL 用 EventSource 连上此 SSE，并把每个 step 实时 push 到 `<el-timeline>` 上沿。
3. THE 测试结果 SHALL 自动结束（连接 close），无需用户手动 stop。
4. THE `final` event 数据结构兼容现有 `/test` 同步接口（保证向后兼容，前端若用 SSE 失败可回退同步）。

**Correctness Properties**：
- CP-8：测试 DuckDuckGo provider 在沙箱失败时，UI 在 ≤ 1 s 内显示「连接失败」+ 步骤日志

---

## 4. Out-of-Scope

1. **每个 Provider 单独的 Agent 调用**：不在大模型内置搜索路径中做专门的 provider 偏好
2. **多 Provider 集群负载均衡**：仍按 DB 全局单一 provider
3. **离线模式兜底**：本期不实现本地搜索引擎
4. **博查 / Tavily 海外合规 / ICP 备案**：本期默认 polyfill，详细授权留客户自己

---

## 5. Compliance / Quality

- 风格沿用 SPEC-260714 / SPEC-260716 EARS / INCOSE 规范
- 错误码：复用既有 i18n 错误码体系 + 新增 WEB_SEARCH_PROVIDER_NOT_CONFIGURED / WEB_SEARCH_PROVIDER_FAILED
- 密钥：所有 Provider API Key 用 AES-256-CBC 加密落库（与 aliconfig / web_search_configs 一致）
- 数据迁移：所有 DB schema 变更用 TypeORM migration
- 性能：Provider SSE 端点超时 30 s 内必须返回 done 或 error
- 安全：API Key 不出现在任何响应体 / 日志中