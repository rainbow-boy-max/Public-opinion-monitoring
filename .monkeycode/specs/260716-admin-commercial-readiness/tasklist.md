# 实施计划：admin-commercial-readiness（260716）

> 文档基线：`.monkeycode/specs/260716-admin-commercial-readiness/requirements.md` + `design.md`
> 优先级：REQ-2 (LLM 崩溃) > REQ-1 (KPI 一致) > REQ-3 (KB 可见) > REQ-4 (KB 下限) > REQ-5 (能力检测)
> 任务标记 `*` 为可选实施项。

---

## 1. REQ-2 — 修 LLM 管理页崩溃（最严重，置顶）

- [ ] 1. `frontend-admin/src/main.ts` 同步加载 `app.use(ElementPlus)` 作为兜底（按需保留为 hot patch）
  - 保留 48 个 EP 组件的按需注册循环
  - 在循环后再 `app.use(ElementPlus)`，让 EP 自动注册未列出的子组件（ElPopper / ElCollection / ElFocusTrap 等）
  - 关联：REQ-2.1 / REQ-2.2

- [ ] 2. `frontend-admin/src/pages/LlmModelsManagementPage.vue` 移除 `el-tabs :lazy="true"`
  - lazy 边界与 el-dropdown 在切 tab 时有 unmount/restore race
  - 改为正常挂载；首次 mount 时仍按需加载表格内容
  - 关联：REQ-2.1 / REQ-2.2

- [ ] 3. 检查点：CP-3（dev 终端控制台 0 红）
  - 浏览器进入 `/llm-models` → 切 5 次厂商 tab → 切回"全部"
  - DevTools Console 应无 unhandled rejection

## 4. REQ-1 — 仪表盘与用户管理数据口径一致

- [ ] 4. 后端：`UserManagementService.listUsers` 增加可选 `role?: string`
  - 不传或空字符串 → 不过滤
  - 传 `'user'` / `'admin'` / `'operator'` → 同字段过滤
  - 关联：REQ-1.3 / REQ-1.4

- [ ] 5. 后端：`AdminController.listUsers` DTO `@Query('role')` 允许空字符串
  - 与现有 status/search/startDate/endDate 一致风格

- [ ] 6. 后端：`DashboardService.getOverview(roleFilter?: string)`
  - 接受 `roleFilter` 参数；缓存 key 改为 `admin:dashboard:overview:${roleFilter ?? 'all'}`
  - usersTotal SQL 与 `UserManagementService.listUsers` 同一行条件复用（通过 service 暴露私有方法或新建 `countByRole`）
  - 关联：REQ-1.1 / REQ-1.2 / REQ-1.3 / CP-1 / CP-2

- [ ] 7. 后端：`DashboardController.overview` 接受 `roleFilter` query

- [ ] 8. 前端：`UserManagementPage.vue` 增加 tab 切换（全部 / 普通用户 / 管理员 / 运营）
  - tab 切时同时刷新 `/users?role=` 与（可选）`/dashboard/overview?role=` 让卡片同步
  - 关联：REQ-1.4

- [ ] 9. 前端：`DashboardPage.vue` 默认请求 `?roleFilter=user`
  - 卡片显示 `total` 数字，并在加载出错时显示 "—"

- [ ] 10. 检查点：CP-1 / CP-2
  - curl `/overview` 与 `/users` 在任意 role 下一致

## 11. REQ-3 — AI 智能体可见并可勾选"已就绪"知识库

- [ ] 11. 后端：`KnowledgeBasesService.listAvailableKbs` 返回 `id: Number(k.id)`
  - 解决 `kb.id` 为字符串 `'"1"'` 与前端 `number[]` 不匹配
  - 关联：REQ-3.3 / CP-4

- [ ] 12. 前端：`AgentDetailPage.vue` 防御性转换
  - `loadAllKbs()` 后 `allKbs.value = (data || []).map((k) => ({ ...k, id: Number(k.id) }))`
  - `loadAgentKbBindings()` 把后端返回的 ids 同样 `Number()`
  - 关联：REQ-3.3 / CP-5

- [ ] 13. 检查点
  - 浏览器：进 `/agents/:id` → "知识库"Tab 勾选 → 保存 → 刷新仍选中

## 14. REQ-4 — 知识库下限 1，上限无限制

- [ ] 14. 前端：`AgentDetailPage.vue` el-form rules 增加 KB 校验
  - 自定义 validator：`kbEnabled && knowledgeBaseIds.length < 1 → "请至少勾选 1 个知识库"`
  - 关联：REQ-4.2

- [ ] 15. 后端：`AgentsService.create/update` 校验 KB
  - `kbEnabled === 1 && (!Array.isArray(dto.knowledgeBaseIds) || dto.knowledgeBaseIds.length < 1)` → 抛 `BadRequestException('KB_VALIDATION_FAILED')`，沿用错误码体系
  - 后端 create(dto) 当前不接收 `knowledgeBaseIds`，需要：
    - 给 create DTO 加 `@IsOptional() @IsArray() knowledgeBaseIds?: number[]`
    - create/update 末尾写 `bindingRepo`：UPSERT agent_kb_bindings（DELETE + INSERT 模式防 race）
  - 关联：REQ-4.3 / CP-6

- [ ] 16. 提交后 cross-check
  - curl 创建智能体时 `knowledgeBaseIds=[]` 必须 422

## 17. REQ-5 — 模型能力自动检测与提示

- [ ] 17. 后端：`LlmModelEntity` / `AgentEntity` 加 `capabilities` JSON 字段
  - `LlmModelEntity.capabilities` 默认 `{ vision: false, reasoning: false, webSearch: false }`
  - `AgentEntity.capabilities` nullable
  - 关联：REQ-5.1 / REQ-5.6

- [ ] 18. migration `1700000050000-AddCapabilities.ts`
  - ALTER 两条表加 JSON 列
  - 关联：REQ-5.1

- [ ] 19. 后端：`LlmModelsService.inferCapabilities(model)`
  - vision: model 名包含 vision/gpt-4o/qwen-vl/glm-4v/claude-3/gemini-1.5 等
  - reasoning: model 名包含 reasoner/-r1/o1/o3/thinking 等
  - webSearch: 默认 false（不下游工具前不打通）
  - 在 `onModuleInit` seed 时对未配置 capabilities 的预设模型调用此 helper
  - 关联：REQ-5.2

- [ ] 20. 后端：`LlmModelsController.save/update` DTO 加 `vision/reasoning/webSearch`
  - `@IsOptional() @IsBoolean()`
  - 落库时合成 `capabilities` JSON

- [ ] 21. 后端：`AgentsService.create/update` 接受 `capabilities`
  - DTO 加 `@IsOptional() @ValidateNested()` 或 `@IsObject()`
  - serialize 时输出
  - 关联：REQ-5.6

- [ ] 22. 前端：`LlmModelsManagementPage.vue` EditModelDialog 加 3 个 capabilities el-checkbox
  - 与 vision / reasoning / webSearch 双向绑定
  - 关联：REQ-5.3

- [ ] 23. 前端：`composables/useAgentCapabilities.ts` composable
  - 输入 primaryModelId，返回 `draft` ref 与 sync 方法
  - 当 modelId 变化时，从已加载的 `allModels.value` 取 `model.capabilities`；均为 `false` 时返回标志
  - 关联：REQ-5.4 / REQ-5.5 / CP-7 / CP-8

- [ ] 24. 前端：`AgentDetailPage.vue` 接入 composable
  - 选完主用大模型后立刻同步 draft
  - 若 draft 能力全 false → `ElMessageBox.confirm` 弹框 + "打开高级设置"按钮跳到能力 Tab
  - 保存时携带 `capabilities` 字段
  - 关联：REQ-5.4 / REQ-5.5

## 25. REQ-5.8~5.11 — 实际接通外部 Web Search

- [ ] 25. 新建 `backend/src/database/entities/web-search-config.entity.ts`
  - `WebSearchConfigEntity { id, provider, apiKeyEnc, maxResults, isEnabled, updatedAt, updatedBy }`
  - `apiKeyEnc` 使用既有 `CryptoUtil.encrypt()`
  - 关联：REQ-5.10 / CP-10

- [ ] 26. migration `1700000051000-CreateWebSearchConfig.ts`
  - 单条配置表；初始 `isEnabled=false, provider='duckduckgo', maxResults=5`

- [ ] 27. 新建 `backend/src/modules/admin/web-search.providers/duckduckgo.provider.ts`
  - POST `https://html.duckduckgo.com/html/?q=<query>` (form-urlencoded)，User-Agent 不为空
  - HTML 解析（cheerio 或 regex）抽取 `.result__title > a`、`result__snippet`、`result__url`
  - 5s timeout；3 次重试
  - 关联：REQ-5.10

- [ ] 28. 新建 `backend/src/modules/admin/web-search.providers/brave.provider.ts`
  - GET `https://api.search.brave.com/res/v1/web/search?q=<query>&count=N`，`X-Subscription-Token: <apiKey>`
  - JSON 解析 `web.results[]` 的 title/url/description
  - 5s timeout
  - 关联：REQ-5.10

- [ ] 29. 新建 `backend/src/modules/admin/web-search.service.ts`
  - 读 `isEnabled=false` → 抛 `WEB_SEARCH_DISABLED`
  - 根据 `provider` 选对应 provider
  - 缓存：Redis key `web-search:result:<sha256(query)>` TTL 300s
  - 关联：REQ-5.8 / CP-9

- [ ] 30. 新建 `backend/src/modules/admin/web-search.controller.ts`
  - `GET /api/admin/web-search/config` → 返回单条配置（apiKey 字段掩码 `***`）
  - `PUT /api/admin/web-search/config` → 写入加密
  - 关联：REQ-5.11

- [ ] 31. 后端：`AgentsService.chat` 注入 web search
  - 在 `chat(agentId, message, stream)` 读 `agent.capabilities?.webSearch` 
  - true → `await this.webSearchService.search(message)`
  - 命中后把结果拼为系统消息插入 messages
  - 失败 / 关闭 → `warnings: ['WEB_SEARCH_DISABLED']`
  - 关联：REQ-5.8 / CP-9

- [ ] 32. 前端：`WebSearchConfigPage.vue` 新页面
  - 表单：provider select (duckduckgo|brave) / apiKey 密码框 / maxResults number / isEnabled switch
  - 保存调 `PUT /api/admin/web-search/config`
  - 关联：REQ-5.11

- [ ] 33. 前端：路由与菜单
  - `router/index.ts` 加 `/config/web-search`
  - `AdminLayout.vue` 加 menuItems 一项
  - 关联：REQ-5.11

- [ ] 34. 前端：`AgentDetailPage.vue` 测试运行结果显示 warnings
  - chat 返回 `warnings` 渲染为 `ElAlert info`

## 35. 最终

- [ ] 35. 跑 migration + 重启 backend（已开 watch 自动 reload）
- [ ] 36. production build `pnpm --filter frontend-admin build` 验证无编译错误
- [ ] 37. 全部 10 条 Correctness Properties（CP-1 ~ CP-10）回归
- [ ] 38. git commit & 推 spec
- [ ]* 38.1 写 e2e smoke（可选）
