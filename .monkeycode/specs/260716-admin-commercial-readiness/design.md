# Design — 管理端支持商用整改（260716）

Feature Name: admin-commercial-readiness
Spec Version: 260716
Updated: 2026-07-14
Status: Draft

---

## 1. Description

本设计落实 requirements.md 中 5 条 EARS 需求的技术方案。重点说明：

1. 数据一致性 + 多 Tab 角色筛选下的 KPI 兜底
2. LlmModelsManagementPage 崩溃的真因定位与按需注册兜底
3. KB available 字段类型（bigint 字符串）与 el-checkbox 选中态匹配
4. KB 选择下限 1 的前后端校验
5. LlmModel 与 Agent 双层 capabilities JSON 字段 + 智能体创建时的能力引导弹框

---

## 2. Architecture

```mermaid
flowchart TB
  subgraph Frontend[frontend-admin]
    direction TB
    Dashboard["DashboardPage\nKPI 总用户数 + roleFilter"]
    UsersPage["UserManagementPage\ntab 切换全部 / 普通 / 管理员 / 运营"]
    LLMPage["LlmModelsManagementPage\n(vendor EP + lazy=false)"]
    LLMDialog["EditModelDialog\n+ 三个 capabilities checkbox"]
    AgentsPage["AgentDetailPage\nKB 勾选下限 1 + 能力引导弹框"]
    Dashboard -->|roleFilter| DashboardAPI
    UsersPage --> DashboardAPI
  end

  subgraph Backend[backend]
    direction TB
    DashboardCtrl["AdminDashboardController\nGET /overview?roleFilter=..."]
    DashboardSvc["DashboardService"]
    UserMgmtSvc["UserManagementService\n新增 filterByRoleParam"]
    LlmsCtrl["LlmModelsController\n(POST/PUT 接受 capabilities)"]
    KbCtrl["agents/knowledge-bindings.controller"]
    AgentsCtrl["AgentsController\n(POST/PUT 接受 capabilities)"]
    AgentSvc["AgentsService\n服务端正向校验 KB≥1 + capabilities"]
    LlmModelSvc["LlmModelsService\n新增 capability 推断 helper"]
  end

  subgraph DB
    Users[("users")]
    Kb[("knowledge_bases")]
    LlmModels[("llm_models\n+capabilities JSON")]
    Agents[("agents\n+capabilities JSON")]
  end

  RedisCache[(Redis\nadmin:dashboard:overview:{roleFilter})]

  DashboardCtrl --> DashboardSvc --> Users
  DashboardSvc --> RedisCache
  UserMgmtSvc --> Users
  LlmsCtrl --> LlmModelSvc --> LlmModels
  AgentsCtrl --> AgentSvc --> Agents
  AgentSvc --> Agents
  KbCtrl --> AgentSvc
  AgentsCtrl --> AgentSvc --> Kb
  AgentsPage --> AgentsCtrl
  Dashboard --> DashboardCtrl
  UsersPage --> UserMgmtSvc
  LLMPage --> LlmsCtrl
  LLMDialog --> LlmsCtrl
```

---

## 3. 数据模型

### 3.1 LlmModel 能力字段

在 `backend/src/database/entities/agent.entity.ts` 的 `LlmModelEntity` 加 JSON 列：

```ts
@Column({ name: 'capabilities', type: 'json', default: () => "(JSON_OBJECT())" })
capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean };
```

### 3.2 Agent 能力字段

`AgentEntity` 同样加 JSON 列：

```ts
@Column({ name: 'capabilities', type: 'json', nullable: true })
capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean } | null;
```

### 3.3 Migration

`backend/src/database/migrations/1700000050000-AddCapabilities.ts`：

```sql
ALTER TABLE llm_models
  ADD COLUMN capabilities JSON NOT NULL DEFAULT (JSON_OBJECT('vision', false, 'reasoning', false, 'webSearch', false));

ALTER TABLE agents
  ADD COLUMN capabilities JSON NULL;
```

### 3.4 KB 列表返回类型校正

`KnowledgeBasesService.listAvailableKbs` 现有 `id: k.id`，TypeORM bigint 序列化为字符串。改为：

```ts
return kbs.map((k) => ({
  id: Number(k.id),
  name: k.name,
  ...
}));
```

---

## 4. Components and Interfaces

### 4.1 后端

| 路径 | 类 | 变更 |
|---|---|---|
| `backend/src/database/entities/agent.entity.ts` | `LlmModelEntity` | 加 `capabilities` JSON 列 |
| `backend/src/database/entities/agent.entity.ts` | `AgentEntity` | 加 `capabilities` JSON 列 |
| `backend/src/database/entities/web-search-config.entity.ts` | `WebSearchConfigEntity` | 新表 |
| `backend/src/database/migrations/1700000050000-AddCapabilities.ts` | migration | 加 capabilities JSON |
| `backend/src/database/migrations/1700000051000-CreateWebSearchConfig.ts` | migration | 新建 web_search_configs 表 |
| `backend/src/modules/agents/llm-models.service.ts` | `LlmModelsService` | `inferCapabilities(model)`；save/update 接受 capabilities；preset seed 写入能力 |
| `backend/src/modules/agents/agents.service.ts` | `AgentsService.create/update` | 校验 KB ≥ 1；返回 capabilities 字段；chat 时按 webSearch 调 WebSearchService |
| `backend/src/modules/agents/llm-models.controller.ts` | `LlmModelsController.save/update` DTO | 加 `IsBoolean() @IsOptional() vision/reasoning/webSearch` |
| `backend/src/modules/admin/services/user-management.service.ts` | `UserManagementService.listUsers` | 接受 `role? string`，空字符串返回全角色 |
| `backend/src/modules/admin/admin.controller.ts` | `AdminController.listUsers` DTO | `role` 显式可选 |
| `backend/src/modules/admin/dashboard.service.ts` | `DashboardService.getOverview` | 接受 `roleFilter`，缓存 key 区分；usersTotal 与 user-mgmt-service 同一口径 |
| `backend/src/modules/admin/dashboard.controller.ts` | `AdminDashboardController.overview` | `@Query('roleFilter') roleFilter?: string` |
| `backend/src/modules/knowledge/knowledge-bases.service.ts` | `listAvailableKbs` | `id: Number(k.id)` |
| `backend/src/modules/admin/web-search.service.ts` | `WebSearchService` 新模块 | `search(query)` 抽象 provider；redismem cache 5min |
| `backend/src/modules/admin/web-search.providers/` | BraveProvider / DuckDuckGoProvider | 实现 `search(query): Promise<SearchResult[]>`, 自带超时与重试 |
| `backend/src/modules/admin/web-search.controller.ts` | `AdminWebSearchController` | GET/PUT `/api/admin/web-search/config` |
| `backend/src/modules/admin/admin.module.ts` | imports | 注册 WebSearch 模块；DashboardService 复用 UserManagementService |
| `backend/src/modules/agents/agents.module.ts` | imports | WebSearchModule 导入；AgentsService.chat 调用 WebSearchService.search |

### 4.2 前端

| 路径 | 文件 | 变更 |
|---|---|---|
| `frontend-admin/src/pages/DashboardPage.vue` | Dashboard | `roleFilter` 默认 `user`，接后端 KPI + 同步列表 |
| `frontend-admin/src/pages/UserManagementPage.vue` | UserManagement | 顶部 tab：全部 / 普通用户 / 管理员 / 运营；切换时调 `/users?role=` 与 `/dashboard/overview?role=`（可忽略 cache） |
| `frontend-admin/src/main.ts` | main | 同时 `app.use(ElementPlus)` + 按需注册（兜底），用于修复崩溃 |
| `frontend-admin/src/pages/LlmModelsManagementPage.vue` | Models | 删除 `el-tabs :lazy`（避免 el-dropdown unmount/restore race） |
| `frontend-admin/src/pages/LlmModelsManagementPage.vue` | EditModelDialog | 加 capabilities 3 个 el-checkbox |
| `frontend-admin/src/pages/AgentDetailPage.vue` | AgentDetail | `knowledgeBaseIds` 类型 `number[]`；`loadAllKbs` 用 `id: Number(kb.id)`；保存校验 KB ≥ 1；能力引导 |
| `frontend-admin/src/pages/WebSearchConfigPage.vue` | 新页面 | provider / apiKey / maxResults / isEnabled 表单 |
| `frontend-admin/src/composables/useAgentCapabilities.ts` | 新增 composable | 处理 modelId 变化时同步 capabilitiesDraft |
| `frontend-admin/src/router/index.ts` | route | 加 `/config/web-search` |
| `frontend-admin/src/layouts/AdminLayout.vue` | menu | "Web 搜索配置"入口 |

### 4.3 Web Search 模块

- `web_search_configs` 单条配置：provider / apiKey (encrypted) / maxResults / isEnabled / updatedAt / updatedBy
- `WebSearchService.search(query)`：
  - 读 `isEnabled=false` → 抛 `WEB_SEARCH_DISABLED`
  - provider=duckduckgo → DuckDuckGoProvider.fetch (HTML scrape, 5s timeout, 解析 title/snippet/url)
  - provider=brave → BraveProvider.fetch (HTTP GET `Authorization: Bearer <key>`)
  - 缓存：key = `web-search:result:<sha256(query)>` TTL 300s
- 注入到 chat：system message 形如：

```
[Web Search Results]
1. <title>
   <url>
   <snippet>

2. <title>
   ...
```

### 4.4 接口契约（新增 / 修改）

`GET /api/admin/dashboard/overview?roleFilter=user|admin|operator|`
- roleFilter：默认 `user`；传空字符串或缺省 → 全部
- 返回：`{ kpis: { ..., usersTotal }, ... }`

`GET /api/admin/users?role=`：role 可空，列表默认全角色

`GET /api/admin/web-search/config`
- 返回：单条配置（apiKey 掩码为 `***`）

`PUT /api/admin/web-search/config`
```json
{ "provider":"brave", "apiKey":"BSA...", "maxResults":5, "isEnabled":true }
```

`POST /api/agents`
```json
{
  ...existing,
  "knowledgeBaseIds": [1, 2],
  "capabilities": { "vision": false, "reasoning": true, "webSearch": false }
}
```

`PUT /api/agents/:id` 接受相同可选字段。

`POST /api/agents/:id/chat` 返回体增加 `warnings?: string[]`，其中 `WEB_SEARCH_DISABLED` 表示 web_search 被配置关/未配置时调用。

---

## 5. Correctness Properties

| # | 描述 | 验证 |
|---|---|---|
| CP-1 | KPI usersTotal ≡ /users 默认 total | curl 同时调用两端，差值 = 0 |
| CP-2 | role=admin 时 dashboard usersTotal 等于 admin 条数 | curl `?roleFilter=admin` |
| CP-3 | LlmModelsManagementPage 不再抛 undefined.opaque | dev server reload，控制台 0 红 |
| CP-4 | KB available id 为 number 类型 | curl `/admin/knowledge/available`，id 是 `1` 而非 `"1"` |
| CP-5 | KB=0 保存被前后端同时拒绝 | UI 校验 + 后端 422 |
| CP-6 | 选 qwen-vl-max 时 draft.capabilities.vision=true | 浏览器手测 |
| CP-7 | 选 custom:custom-foo 弹 ElMessageBox | 浏览器手测 |
| CP-9 | webSearch=true + 配置 Brave key 时 chat ≤ 8 s 返回且 system 含 `Web Search Result` 块 | curl `/api/agents/:id/chat` 并 grep 返回体 |
| CP-10 | web_search_config.apiKey AES-256-CBC 加密落库，读出掩码为 `***` | 后端 review + 检查 DB |

---

## 6. Error Handling

| 场景 | 处理 |
|---|---|
| /overview 缓存命中但 roleFilter 改变 | 缓存 key 区分 `(roleFilter)`，切换自动失效 |
| KB 选择后端 422 | 前端 `ElMessage` 用 i18n 错误码 `KB_VALIDATION_FAILED` 提示 |
| 能力未声明 | 前端 `ElMessageBox` 提示，附带"打开高级设置"快捷动作 |
| LlmModel 编辑但未配置 API Key | 保留旧逻辑（`PLACEHOLDER_ENCRYPTED`） |
| 后端 LlmModel edit 时 capabilities 字段类型不符 | DTO `@IsBoolean()` 校验，422 |

---

## 7. Test Strategy

### 后端
- `agents.service.spec.ts`：KB≥1 拒绝；capabilities 写库；preset seed 自动推断
- `dashboard.service.spec.ts`：roleFilter 全角色/user 两条 SQL 路径返回值与 UserManagementService 一致
- `knowledge-bases.service.spec.ts`：`listAvailableKbs` 返回 id 为 number
- migration 验证：`pnpm migration:run` 后 `DESCRIBE llm_models` 含 `capabilities` JSON 列

### 前端（手测）
- `/dashboard` 默认 roleFilter=user，与 `/users?role=user` 同时调用，total 一致
- `/users` 顶部切换 tab"全部 / 普通用户 / 管理员"，列表与 KPI 一同变化
- `/llm-models`：取消 lazy 后能稳定渲染 el-dropdown
- LLM 编辑对话框 3 个 capabilities checkbox 正常保存
- `/agents/:id` 知识库 Tab：列表显示 ready KB，可勾选；至少 1 个才能保存
- 智能体创建：选 qwen-vl-max 立即看到 vision 草稿；选 custom:custom-foo 弹引导框

---

## 8. References

- [^1]: `.monkeycode/specs/260716-admin-commercial-readiness/requirements.md`
- [^2]: `.monkeycode/specs/260714-fix-admin-experience/design.md`（既有整改基线）
- [^3]: `backend/src/modules/agents/llm-models.service.ts`
- [^4]: `backend/src/modules/agents/agents.service.ts`
- [^5]: `frontend-admin/src/pages/AgentDetailPage.vue`
- [^6]: `frontend-admin/src/pages/LlmModelsManagementPage.vue`
- [^7]: `frontend-admin/src/pages/DashboardPage.vue`
- [^8]: `frontend-admin/src/pages/UserManagementPage.vue`
