# Requirements Document — 管理端支持商用整改（0607-16 反馈）

Feature: 0.16-admin-commercial-readiness
Spec Version: 260716
Status: Draft
Owner: Admin Frontend Team
Date: 2026-07-14

---

## 1. Introduction

承接 260714-fix-admin-experience 之后的用户验收，反馈 5 个支持商用的整改项：

| # | 名称 | 性质 |
|---|---|---|
| REQ-1 | 仪表盘用户数与用户管理列表数据不一致 | 数据一致性 bug |
| REQ-2 | LLM 大模型管理页崩溃（控制台 TypeError） | 运行时崩溃 |
| REQ-3 | AI 智能体详情页无法勾选"已就绪"知识库 | 数据类型 / 集成 bug |
| REQ-4 | AI 智能体的知识库选下限 1，上限无限制 | 业务规则 |
| REQ-5 | AI 智能体创建配置：模型选完后自动检测能力（图片理解 / 推理 / 联网搜索）；无法自动判断时弹框引导 | 新功能 |

每条整改都要满足"支持商用"标准：可演示、可重现、可监控、可回滚。

---

## 2. Glossary

| 术语 | 含义 |
|---|---|
| 仪表盘 | 管理端 `/dashboard` 路由 |
| 用户管理 | 管理端 `/users` 路由 |
| LLM 模型管理 | 管理端 `/llm-models` 路由 |
| 知识库 / KB | 后端 `knowledge_bases` 表中 status='ready' 的条目 |
| 智能体 / Agent | 后端 `agents` 表中的条目 |
| 能力 / Capabilities | 模型或智能体支持的扩展特性 `{ vision: bool, reasoning: bool, webSearch: bool }` |
| 预置模型 | `is_preset=1` 的 LLM 模型，由 service 启动时 seed 注入 |

---

## 3. Requirements

### REQ-1 仪表盘与用户管理数据口径对齐

**User Story**: AS 管理员, I WANT 在仪表盘与用户管理看到相同的用户统计口径, SO THAT 不会被误导认为平台有"用户"但找不到人。

**Acceptance Criteria**:

1. WHEN 管理员查看仪表盘 KPI 卡片"总用户数", THE 后端 SHALL 返回当前 `users` 表中满足与"用户管理列表相同筛选条件"的总条数（默认 `role='user'`）。
2. WHEN 管理员在用户管理页面查看列表, THE 列表 SHALL 与仪表盘同一时刻返回相同的"用户数"卡片值。
3. WHILE 仪表盘 KPI 卡片处于"全部角色 = N"模式, THE 用户管理列表 SHALL 默认显示全角色，查询参数默认 `role=` 留空，列表视图可见 admin/operator/user。
4. WHEN 管理员在用户管理页面切换角色筛选 chip, THE 列表 SHALL 仅展示对应角色的用户，仪表盘 KPI 卡片 SHALL 显示当前筛选下的子集计数（不入缓存）。
5. IF 仪表盘聚合 SQL 失败, THE 卡片 SHALL 退化为 "—" 且不再阻塞其它卡片渲染。

**数据契约**：
- `GET /api/admin/dashboard/overview?roleFilter=user` 返回 `{ ..., kpis: { ..., usersTotal: 3 } }`
- `GET /api/admin/users?role=user&page=1&pageSize=20` 返回 `{ items: [...], total: 3 }` 应等于 `usersTotal`。

**Correctness Properties**：
- CP-1：在任意时刻 T，`/dashboard/overview` 的 `usersTotal` ≡ `/users` 在默认筛选下的 `total`。
- CP-2：缓存（含 30 s Redis）失效/命中时数值仍与同口径 `/users` 总数一致。

---

### REQ-2 LLM 大模型管理页可正常打开

**User Story**: AS 管理员, I WANT 进入 `/llm-models` 不会触发白屏崩溃, SO THAT 我能配置厂商模型用于业务。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/llm-models`, THE 页面 SHALL 在 2 s 内完成首个骨架渲染，未触发任何 `TypeError: Cannot read properties of undefined (reading 'opaque')` 类异常。
2. WHEN 管理员切换厂商 tab, THE 表格 SHALL 平稳切换，el-dropdown 控件 SHALL 正常工作。
3. IF 用户在生产也遇到 white-screen 类崩溃，THE app.mount 之前 SHALL 已注册 `app.config.errorHandler`，堆栈 SHALL 直接渲染到 `#app` 节点不再白屏（已有的 errorHandler 在 dev 也保持）。

**Correctness Properties**：
- CP-3：连续切换厂商 tab ≥ 5 次无 unhandled rejection。
- CP-4：控制台 0 红、`/api/admin/front-metrics` 仍能收到切页耗时埋点。

---

### REQ-3 AI 智能体详情页可见并可勾选"已就绪"知识库

**User Story**: AS 管理员, I WANT 在编辑智能体的"知识库"Tab 中看到所有 `ready` 的知识库并能勾选保存, SO THAT 智能体可被业务复用。

**Acceptance Criteria**:

1. WHEN 管理员打开 `/agents/:id` 进入"知识库"Tab, THE 列表 SHALL 展示 `GET /api/admin/knowledge/available` 返回的全部 `ready` 知识库，包含 `id / name / fileCount / aiScore` 字段。
2. WHEN 管理员勾选至少 1 个 KB, THE 复选框 SHALL 视觉呈现已选状态；保存后 `GET /api/admin/agents/:id/knowledge-bases` SHALL 返回勾选的数字数组。
3. IF 后端返回的 `id` 是字符串（bigint 序列化），THE 前端 SHALL 在渲染前统一转换为 `Number`，保证 `el-checkbox` 选中态匹配 `form.knowledgeBaseIds`。
4. IF 知识库后端列表为空, THE Tab SHALL 显示空态占位 + "去创建知识库"快捷入口（已存在）。

**Correctness Properties**：
- CP-5：保存成功后再次加载智能体，原勾选项 SHALL 仍处于已选状态。

---

### REQ-4 AI 智能体的知识库选择规则

**User Story**: AS 管理员, I WANT 在创建/更新智能体时强制至少选择 1 个知识库且无上限, SO THAT 业务侧不会出现"知识库空配置"导致跑不通的智能体。

**Acceptance Criteria**:

1. WHEN 管理员打开"知识库"Tab, THE 表单 SHALL 默认 `kbEnabled=true` 且至少有 1 个被勾选状态（新建模式下预填空数组由用户勾选；编辑模式回显当前勾选）。
2. WHEN 管理员尝试保存但 `kbEnabled=true && knowledgeBaseIds.length === 0`, THE 前端 SHALL 通过 `el-form` 校验阻止提交，提示"开启知识库时至少勾选 1 个"。
3. WHEN 后端 `POST /api/agents` 或 `PUT /api/agents/:id` 收到 `kbEnabled=1 && !kbIds || kbIds.length<1`, THE 后端 SHALL 返回 422（沿用现有 `KB_VALIDATION_FAILED` 错误码）。
4. THE 知识库选择上限 SHALL 不做硬限制（业务层允许任意多个 KB 关联），UI 仅在 >20 时提示"已关联 N 个"但允许继续保存。

**Correctness Properties**：
- CP-6：`save` 接口在 KB ≥ 1 时一定成功；KB=0 时 100% 拒绝并返回结构化错误。

---

### REQ-5 AI 智能体模型能力自动检测与提示

**User Story**: AS 管理员, I WANT 选择主用大模型后自动勾选它声称支持的能力（图理解 / 推理思考 / 联网搜索）, SO THAT 配置速度提升；如果模型未声明能力，弹框提示管理员手动勾选。

**Acceptance Criteria**:

1. THE 后端 SHALL 在 `llm_models` 表新增 `capabilities` JSON 字段，默认 `{ vision: false, reasoning: false, webSearch: false }`。
2. WHEN 系统初始化预置模型 seed 时, THE 后端 SHALL 根据模型 `model` 字段关键词命中能力，例如：
   - `vision` ⇐ 模型名包含 `vision` / `gpt-4o` / `qwen-vl` / `glm-4v` / `claude-3` / `gemini-1.5` 等
   - `reasoning` ⇐ 模型名包含 `reasoner` / `-r1` / `o1` / `o3` / `thinking` 等
   - `webSearch` ⇐ 全部默认 `false`（下游需对接专属工具）
3. WHEN 管理员在 LLM 管理页编辑/添加模型时, THE 对话框 SHALL 显示 3 个 el-checkbox（图片理解 / 推理与思考 / 联网搜索）并落库到 `capabilities`。
4. WHEN 管理员在智能体详情页选完"主用大模型", THE 前端 SHALL 立刻用选中的模型 `capabilities` 写入 `agent.capabilitiesDraft`（仅前端草稿）。
5. IF 选中的模型 `capabilities` 三项均为 `false`，THE 前端 SHALL 通过 `ElMessageBox.confirm` 弹框"该模型未声明能力，请确认是否手动勾选"，提供"打开高级设置"按钮 → 切到智能体能力 Tab。
6. THE 后端 SHALL 在 `agents` 表新增 `capabilities` JSON 字段，与 llm_models 同结构，保存时允许覆盖。
7. WHEN 智能体被运行时调用, THE 后端 SHALL 在 prompt 注入"能力提示"（如 vision=true 时告知 LLM 当前支持图片输入）。
8. WHEN 智能体 `webSearch=true` 且后端 `web_search_configs.is_enabled=true` 且 provider 配置可用, THE 后端 SHALL 在调用大模型前自动调 `WebSearchService.search(query=userMessage)`，把 Top N 条结果的 title/url/snippet 拼入 system message，再发 LLM。
9. WHEN 智能体 `webSearch=true` 但 web_search_configs 未启用 / key 缺失 / provider 异常, THE 后端 SHALL 在响应体中返回 `warnings: ['WEB_SEARCH_DISABLED']`，前端 SHALL 在测试运行结果区附加一行提示。
10. THE 后端 SHALL 支持两种搜索 provider：
   - `duckduckgo`：免 key 的 HTML 端点 `https://html.duckduckgo.com/html/`，无需配置可用，但有 rate-limit；
   - `brave`：Brave Search API `https://api.search.brave.com/res/v1/web/search`，需要 API Key。
11. THE 管理端 SHALL 在 `/config/web-search` 提供表单（provider / apiKey / maxResults / isEnabled），保存后立刻生效。

**Correctness Properties**：
- CP-7：选择 1 个有声明能力的预置模型（如 `qwen-vl-max`），前端 SHALL 立即把 `vision:true` 写入草稿，不弹框。
- CP-8：选 `custom:custom-foo`（自定义无能力），前端 SHALL 弹 ElMessageBox。
- CP-9：开启 `webSearch=true` 且配置 Brave key 时，chat 接口响应 ≤ 8 s 返回，且结果的 system message 包含至少 1 条 `Web Search Result:` 行。

---

## 4. Out-of-Scope（明确不做）

1. **多模态输入（图片 / 文件上传）前端**：本期不实现 UI，仅在 prompt 注入能力声明。
2. **能力权限控制**：本期不区分角色可见的能力；任何管理员都能勾选任意能力（避免复杂度）。
3. **多 provider 切换的运行时切换**：本次仅支持 admin 一次性配置 provider，全局唯一；不做 model 级别 provider override。

---

## 5. Compliance / Quality

- 风格：沿用 SPEC-260714 的 EARS + INCOSE 规则
- 错误码：复用后端现有 i18n 错误码体系（KB_VALIDATION_FAILED / INTERNAL_ERROR 等）
- 数据迁移：所有 schema 变更必须通过 TypeORM migration 而非 `synchronize: true`
- 性能：仪表盘 KPI 30 s Redis 缓存；其他接口按现状
- 安全：能力声明不暴露任何 API Key / Token
