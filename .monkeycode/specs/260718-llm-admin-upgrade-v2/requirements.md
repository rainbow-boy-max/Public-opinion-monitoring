# Requirements Document v2 — 管理端 LLM 模型管理升级（Anthropic 兼容 + 批量）

Feature: llm-admin-upgrade-v2
Spec Version: 260718-3
Status: Draft
Owner: Admin Frontend Team
Updated: 2026-07-14

---

## 1. Introduction

基于用户对 v1 规格的反馈做的增量调整：

| # | 增量项 | 来源 |
|---|---|---|
| REQ-6 | 每个 LLM 模型新增 `apiStyle` 字段，支持 OpenAI 兼容 / Anthropic 兼容 两种调用风格 | 用户 #1 |
| REQ-7 | 预置厂商补 `deepseek_anthropic`、`minimax_anthropic` 两条端点（baseUrl 指向官方 Anthropic 兼容 URL）| 联网调研 |
| REQ-8 | MiniMax-M3 在 `apiStyle=anthropic` 下推断 `vision=true, reasoning=true`；`apiStyle=openai` 下两者都 `false` | 用户 #2 + 调研 |
| REQ-9 | 批量启用/禁用 UI：成功数 + 跳过数 + 失败数分别提示 | 用户 #3 |

v1 其它 5 项（REQ-1 ~ REQ-5）保持不变。

---

## 2. Glossary

| 术语 | 含义 |
|---|---|
| apiStyle | 模型调用风格：`'openai'`（OpenAI 兼容协议 /chat/completions）或 `'anthropic'`（Anthropic 兼容协议 /v1/messages） |
| system prompt 顶层 | Anthropic 协议中 `system` 是请求体顶层字段；OpenAI 协议中是 messages 数组的 `system` role |
| 跳过 | 批量操作时某些 ID 因无 Key 或其它校验被自动略过（不会 throw 整批） |

---

## 3. Requirements

### REQ-6 apiStyle 字段

**User Story**: AS 管理员, I WANT 每个 LLM 模型可以选择 OpenAI 兼容或 Anthropic 兼容调用风格, SO THAT 我能根据厂商是否支持 Anthropic 协议选择对应端点。

**Acceptance Criteria**:

1. THE `llm_models` 表新增 `api_style ENUM('openai', 'anthropic') NOT NULL DEFAULT 'openai'` 字段。
2. WHEN 管理员保存模型, THE 后端 SHALL 接受 `apiStyle` 字段（`'openai'` 或 `'anthropic'`）；非法值返回 422。
3. THE 列表/详情接口 SHALL 输出 `apiStyle` 字段。
4. THE `LlmRouterService.chat/streamChat` SHALL 根据 `apiStyle` 选择调用端点：
   - `'openai'` → POST `{baseUrl}/chat/completions`（已有路径）
   - `'anthropic'` → POST `{baseUrl}/v1/messages`（新增 Anthropic Messages 端点）
5. WHEN `apiStyle='anthropic'` 调用，THE LlmRouter SHALL：
   - 将 `systemPrompt` 转为请求体顶层 `system` 字段（不放入 messages 数组）
   - messages 仅包含 `user` / `assistant` 角色
   - 鉴权头从 `Authorization: Bearer` 改为 `x-api-key: <KEY>` + `anthropic-version: 2023-06-01`
6. THE chat 响应 SHALL 兼容两种格式：流式 SSE 与 OpenAI 一样；非流式从 `content[0].text` 提取文本。

**Correctness Properties**：
- CP-12：`apiStyle='anthropic'` 模型 chat 时 `curl` 显示请求路径 `/v1/messages`、鉴权头 `x-api-key`
- CP-13：非法 apiStyle 值 → 后端 422

---

### REQ-7 Anthropic 兼容预置端点

**User Story**: AS 管理员, I WANT 在 LLM 模型预置列表里能选到 DeepSeek 与 MiniMax 的 Anthropic 兼容端点, SO THAT 我能用 Claude Code / Cursor 等仅支持 Anthropic 协议的客户端。

**Acceptance Criteria**:

1. THE `LlmModelsService.PRESET_PROVIDERS` 增补两个新条目：
   - `provider: 'deepseek_anthropic'`, `displayName: 'DeepSeek (Anthropic 兼容)'`, `baseUrl: 'https://api.deepseek.com/anthropic'`, `apiStyle: 'anthropic'`, 模型 v3.2 与 v4-pro / v4-flash
   - `provider: 'minimax_anthropic'`, `displayName: 'MiniMax (Anthropic 兼容)'`, `baseUrl: 'https://api.minimax.io/anthropic'`, `apiStyle: 'anthropic'`, 模型 M3 / M2.7 / M2.5 / M2.1 / M2
2. 已有 `deepseek` provider 保持 `apiStyle='openai'`（向后兼容）
3. 已有 `minimax` provider 保持 `apiStyle='openai'`
4. WHEN seed 启动，THEN 两个新 provider 与原 6 个 + minimax 一起 seed 进表

**Correctness Properties**：
- CP-14：`GET /admin/llm-models/presets` 返回的 providers 包含 8 个

---

### REQ-8 M3 capabilities 按 apiStyle 推断

**User Story**: AS 管理员, I WANT 选 Anthropic 兼容端点的 MiniMax-M3 自动勾上 vision + reasoning，OpenAI 兼容端点下不勾, SO THAT 智能体能力与端点能力一致。

**Acceptance Criteria**:

1. `LlmModelsService.inferCapabilities(model, provider, apiStyle)`：
   - MiniMax-M3 + apiStyle=anthropic → `vision: true, reasoning: true, webSearch: false`
   - MiniMax-M3 + apiStyle=openai → `vision: false, reasoning: false, webSearch: false`
   - MiniMax-M2.7 / M2.5 / M2.1 / M2 + apiStyle=anthropic → `reasoning: true, vision: false`
   - MiniMax-M2.x + apiStyle=openai → `reasoning: false, vision: false`
2. 其它模型的 vision/reasoning 推断保持原样（按模型名字符串）
3. 用户在编辑对话框手动覆盖后，applyDto 不再用 infer 覆盖（仅首次 seed 用）
4. seed `minimax` provider 的 M3 默认 `apiStyle='openai'`，`vision=false, reasoning=false`；seed `minimax_anthropic` provider 的 M3 默认 `apiStyle='anthropic'`，`vision=true, reasoning=true`

**Correctness Properties**：
- CP-15：seed `minimax_anthropic` 后 `GET /admin/llm-models` 看到 M3 的 `capabilities.vision === true`

---

### REQ-9 批量启用 UI 反馈

**User Story**: AS 管理员, I WANT 批量启用后看到"成功 X 项 / 跳过 Y 项 / 失败 Z 项"分项提示, SO THAT 我知道哪几个模型因无 Key 被跳过。

**Acceptance Criteria**:

1. 后端 `PUT /admin/llm-models/batch` 响应补 `skipped: [{ id, errorCode, message }]` 字段（区别于 `failed`，因为 skipped 是预校验跳过不算错）
2. 前端批量工具栏调用后展示：
   - 全部成功：`ElMessage.success('已启用 N 项')`
   - 部分跳过：`ElMessage.warning('已启用 N 项，跳过 M 项无 API Key，失败 K 项')`
   - 全部跳过：`ElMessage.error('已跳过 N 项无 API Key')`
3. 点击"详情"展开表格列出 skipped/failed 的 id 与 errorCode

**Correctness Properties**：
- CP-16：批量启用 50 个无 Key 模型 → ElMessage.error 文案"已跳过 50 项无 API Key"，不弹成功 toast

---

## 4. Out-of-Scope

1. 其它厂商（DashScope / GLM / Kimi / SiliconFlow / Doubao）官方 Anthropic 端点支持：当前不存在；用户如需 Anthropic 协议访问这些模型，需自建 micro-one-api 代理。本系统**通过 apiStyle='anthropic' + 自由 baseUrl** 已支持这种代理场景
2. MiniMax 视频 / 图像 API
3. Anthropic prompt caching、extended thinking 高级参数
4. 多语言 Provider 描述翻译

---

## 5. Compliance / Quality

- 风格沿用 EARS / INCOSE
- 错误码：复用 + `LLM_KEY_REQUIRED`、`LLM_INVALID_API_STYLE`
- 数据迁移：migration `1700000080000-AddLlmModelApiStyle.ts`
- 性能：chat P95 ≤ 1.5 s（多 1 次 HTTP 路径切换）