# 需求实施计划：admin-experience-fix（260714）

> 文档基线：`.monkeycode/specs/260714-fix-admin-experience/requirements.md` + `design.md`
> 优先级与依赖：`B → A → C → D → E`，B 必须先做以解除详情页编译红屏造成的整个右侧交互被锁。
> 任务标 `*` 的为可选任务（测试 / 文档 / 验收脚本），实施时跳过。

## 1. 工作包 B：智能体详情页编译 / 编辑 / 创建修复

- [ ] 1. 重写 `frontend-admin/src/pages/AgentDetailPage.vue` 知识库选择区为 `el-checkbox-group` 写法
  - 替换第 169–193 行的 `<label v-for>` + `<el-checkbox v-model :value />` 结构为 `<el-checkbox-group v-model>` + 子 `<el-checkbox :value="kb.id">`
  - 保留 `:class="{ 'kb-select-card--selected': form.knowledgeBaseIds.includes(kb.id) }"` 的选中态
  - 验证：`pnpm -C frontend-admin build` 无 [plugin:vite:vue] Unexpected token；浏览器进入 `/agents/new` 与 `/agents/1` 都不出现 vite error overlay
  - 关联：REQ-5

- [ ] 2. 增加"保存全部"入口，合并四类保存
  - 在 `el-tabs` 顶部新增 `<el-button type="primary" plain @click="onSaveAll">保存全部</el-button>`
  - `onSaveAll()` 顺序执行 `onSave` / `onSaveModels` / `onSaveKb`，聚合成功/失败反馈；任一失败不中断，但提示哪一步没保存成功
  - 关联：REQ-6.5

- [ ] 3. 修正创建跳转路由
  - 在 `AgentDetailPage.vue` 的 `onSave()` 内，`POST /agents` 成功后读取 `r?.id ?? r?.agentId ?? r?.data?.id` 三段兼容；`r?.id` 仍为空时 `ElMessage.error('创建成功但未返回 id')` 并停留
  - 关联：REQ-7

- [ ] 4. 检查点：B 包验收（人工 + 浏览器）
  - 浏览器手测：登录 → 进 `/agents/new` → 填写 name/role/温度 → 点"保存基础配置"→ 跳到 `/agents/:id` → 进"知识库"tab → 勾选一个 KB → 点"保存关联" → 进"测试运行"标签可输入并运行
  - 通过条件：浏览器 console 0 红、Network 全 2xx

## 5. 工作包 A：仪表盘实时数据 + `audit_events` 轻量表 + SSE

- [ ] 5. 后端：建表与实体
  - 新建 `backend/src/database/entities/audit-event.entity.ts`（含 `created_at` 索引）
  - 新建 migration `backend/src/database/migrations/*-CreateAuditEvents.ts`
  - 在 `database.module.ts` 中注册实体，运行迁移脚本
  - 关联：REQ-3.1 / REQ-3.3

- [ ] 6. 后端：`audit.service` 写入工具
  - 新建 `backend/src/modules/admin/audit.service.ts`，导出 `record({ actorId, actorType, module, action, resourceType?, resourceId?, title, content?, ip? })`
  - 内置 try/catch，失败仅 `Logger.warn`，不抛
  - 关联：REQ-3.2 / REQ-3.4

- [ ] 7. 后端：在受控接口的成功路径上调用 `audit.record(...)`
  - 至少接入：`agents.controller` 的 `create/update/remove`、`llm-models.controller` 的 create/update/remove/`test`、admin/users 的 create/ban/unban/resetPassword、`auth.controller` 的 login/logout、`agent-kb.processor` 解析完成
  - 在 `admin/audit.controller.ts` 提供 `GET /admin/audit-events` 分页/筛选接口
  - 关联：REQ-3.2

- [ ] 8. 后端：dashboard 聚合接口
  - 新建 `backend/src/modules/admin/dashboard.controller.ts`：`GET /admin/dashboard/overview` / `GET /admin/dashboard/recent-activities` / `@Sse() /admin/dashboard/recent-activities/stream`
  - 新建 `dashboard.service.ts`：聚合 KPI/trend/platform，30s Redis 缓存；recent-activities 直接 `AuditEvent.find({ order: { createdAt: 'DESC' }, take: 20 })`
  - realtime gateway 新增 `publishActivity(payload)`，对 `admin:dashboard:activity` 频道发 JSON 字符串事件
  - SSE 控制器中以 `interval(25_000)` 发心跳 `: ping`
  - 关联：REQ-1 / REQ-2 / REQ-4

- [ ] 9. 前端：`DashboardPage.vue` 接入新接口
  - 删除写死的 `recentActivities.value = [...]`（97–102 行）
  - `onMounted` 内并行 fetch overview 与 recent-activities
  - 新增 `useRecentActivities()` composable（可放 `frontend-admin/src/composables/useRecentActivities.ts`）：用 `EventSource('/api/admin/dashboard/recent-activities/stream')` 订阅，断线 5s 后重连，新事件 `unshift` 到数组并 `slice(0, 20)`
  - 4 张 KPI 卡片的 `value: '-'` 用接口返回值覆盖；trend/platform 图的 option 用返回数据重写
  - `setInterval(60_000)` 重新拉 overview；首次进入图表区域在视口外时跳过
  - 关联：REQ-1 / REQ-2

- [ ] 10. 检查点：A 包验收
  - 后端：`curl -H "Cookie: ..." /api/admin/dashboard/overview` 能看到真实计数；建一个智能体后 `audit_events` 多一行；`/recent-activities/stream` 在终端 `curl -N` 能看到 `event: activity` 推送
  - 前端：进 `/dashboard` ≤ 2s 看到真实活动；再建一个智能体，仪表盘 ≤ 2s 出现新条目

## 11. 工作包 C：LLM 模型管理页性能

- [ ] 11. `LlmModelsManagementPage.vue` 拆分 `computed` + 减少重算
  - 新增 `const byProvider = computed(() => Object.groupBy(tableData.value, m => m.provider))`
  - 渲染厂商 tab 时 `byProvider.value[p.provider] ?? []`；`countByProvider(p)` 改为查表 `(byProvider.value[p] || []).length`
  - 关联：REQ-8.3

- [ ] 12. tab `lazy` + 不重拉
  - `el-tabs` 加 `:lazy="true"`
  - `switchProvider` 处理函数不再触发 `loadData()`，仅切换 `activeProvider`
  - 关联：REQ-8.2 / REQ-8.4

- [ ] 13. 搜索 + 服务端分页
  - 顶部加 `el-input v-model="search"` + 300ms debounce，命中后 `GET /admin/llm-models?search=...`
  - 加 `el-pagination` 与 page/pageSize 绑定，pageSize 默认 20
  - 后端 `llm-models.service.ts` 的 list 增加 `search` 过滤（按 `displayName` / `model` LIKE）
  - 关联：REQ-8.1 / REQ-8.5

- [ ] 14. `ModelsTable.vue` 行级优化
  - `:row-key="(row) => row.id"`；操作列改为 `el-dropdown` 收纳测试/配置/删除
  - `onToggle` 已有，仅把 `http.put(...)` 合并到一个最小 payload
  - 关联：REQ-8.6

- [ ] 15. 检查点：C 包验收（性能）
  - 用 Chrome DevTools Performance 录屏（100 条模型）：首屏 ≤ 800ms；切 6 次厂商 tab 切回"全部"，每次 ≤ 100ms
  - 截图 Performance 报告附 `.monkeycode-tmp-files/`

## 16. 工作包 D：管理端切页性能

- [ ] 16. Element Plus 按需引入
  - `frontend-admin/src/main.ts` 移除 `app.use(ElementPlus)` 与 `import 'element-plus/dist/index.css'`
  - 改为白名单 `for (const c of [...]) app.use(c)`，仅保留本项目用到的组件
  - `vite.config.ts` 加 `optimizeDeps.include` 白名单
  - 关联：REQ-9

- [ ] 17. ECharts 按需 + 工具封装
  - 新建 `frontend-admin/src/utils/echarts.ts`，封装 `createChart(el, type, option)` 与 `disposeChart(chart)`
  - 仅 import `LineChart` / `PieChart` 与必要 components/renderer
  - `DashboardPage.vue` 引用该工具
  - 关联：REQ-10.1 / REQ-10.2

- [ ] 18. `vite.config.ts` 拆 chunk
  - `build.rollupOptions.output.manualChunks` 拆分：echarts 独立 chunk、element-plus/icons 独立 chunk、shared 独立 chunk
  - build 验证产物：`ls frontend-admin/dist/assets | grep echarts`
  - 关联：REQ-10.3 / REQ-9.3

- [ ] 19. 路由 keep-alive
  - `AdminLayout.vue` 模板 `<router-view />` 外包 `<keep-alive :include="['DashboardPage','AgentsPage','LlmModelsManagementPage','KnowledgeBasesPage','SystemLogsPage','UserManagementPage','SmsTemplatesPage','AgentDetailPage']">`
  - `AgentDetailPage` 内 `onActivated` 时如果 `route.params.id` 变化，重新 `loadAgent()`
  - 关联：REQ-11

- [ ] 20. `AdminLayout.vue` 样式与菜单渲染优化
  - 删除侧栏 `backdrop-filter: blur(20px)` 默认值；hover 子菜单时才启用
  - 菜单从 `<router-link custom v-slot>` 改成 `<div @click="router.push(item.path)">` + 自己维护 active
  - 替换顶部恒为 false 的 `<Expand v-if="false" />` 为可切换的折叠按钮（可选）
  - 关联：REQ-12

- [ ] 21. 检查点：D 包验收
  - `pnpm -C frontend-admin build` 通过；首屏 JS gzip ≤ 600KB（不含 map）
  - 浏览器 Lighthouse Performance ≥ 80
  - 切到 `/dashboard` 后切到 `/users` 再切回 `/dashboard`，ECharts 不再 init（DevTools Network 不应有重复 `/api/admin/dashboard/overview` 之外的非 dashboard chunk 请求）

## 22. 工作包 E：前端性能埋点

- [ ] 22. `frontend-admin/src/utils/perf-metrics.ts`
  - `startMark(name)` / `endMark(name, extra?)` / `markAndReport(name, extra?)`
  - 内部 `performance.measure(name, start, end)`，`sendBeacon(url, JSON.stringify({ name, durationMs, ... }))`
  - 失败 fallback 到 `fetch(url, { method: 'POST', keepalive: true })`
  - 关联：REQ-13.1 / REQ-13.2

- [ ] 23. 接入关键路径
  - `main.ts` 监听 `first-contentful-pixel` 或用 `PerformanceObserver({ type: 'paint' })`
  - `router.beforeEach` 标 `route-switch-start`，`router.afterEach` 标 `route-switch-end`
  - `DashboardPage.vue` 包 `echarts.init` start/end
  - 关联：REQ-13.1

- [ ] 24. 后端：`POST /admin/front-metrics`
  - 在 `system-logs.service.ts` 扩展 `create({ level: 'frontend-perf', message: JSON.stringify(payload), module: 'frontend', action: 'metric' })`
  - `admin.controller.ts` 新增 `@Post('front-metrics')` 调用 `systemLogsService.create(...)`
  - 关联：REQ-13.3

- [ ] 25. 检查点：E 包验收
  - 浏览器手动操作若干路径后，`SELECT * FROM system_logs WHERE level='frontend-perf' ORDER BY created_at DESC LIMIT 20` 有对应记录
  - DevTools Network 看 `/api/admin/front-metrics` 返回 204

## 26. 最终检查点：全量回归与文档收口

- [ ] 26. 全量回归
  - 跑通现有 e2e smoke：登录 → 概览 → 用户管理 → 智能体列表 → 智能体详情（基础/模型/知识库/关联各保存一次） → LLM 模型列表 → 知识库列表 → 短信模板 → 系统日志 → 三要素配置
  - 控制台 0 红
  - `frontend-admin` 与 `backend` 全量 `pnpm run build`

- [ ] 27. 文档收口
  - 同步 `.monkeycode/specs/260714-fix-admin-experience/` 三份文件已存在且与最终实现一致
  - 不在用户项目代码中写入任何 Agent 环境 LLM Key

- [ ]* 27.1 可选：property-based 测试
  - audit.service 在 record 时传入空 actor 也不应抛；agent 在不创建成功时 record 也继续；幂等地覆盖
  - 对应设计正确性属性 CP-1 / CP-7

- [ ]* 27.2 可选：单元测试
  - dashboard.service 聚合 KPI/trend/platform 的结构稳定
  - llm-models.service 搜索/过滤行为稳定
  - 对应设计正确性属性 CP-3 / CP-4

- [ ]* 27.3 可选：回归脚本
  - 新增 `frontend-admin/scripts/smoke.ts`（Playwright）覆盖路由切换耗时断言
  - 对应设计 CP-5
