# Requirements Document

Feature: 管理端体验整改（仪表盘实时 / 智能体详情 / LLM 管理 / 切页性能 / 前端监控）
Spec Version: 260714
Status: Draft
Owner: Admin Frontend Team

---

## 1. Introduction

本特性针对舆情监测管理端（frontend-admin）在最近一轮验收中暴露的 5 个体验类问题做一次系统性整改：

1. 仪表盘「最近活动」是前端硬编码的假数据，未读取后端真实事件流；
2. 智能体详情页（AgentDetailPage.vue）编译报错，详情页无法进入，进而"创建智能体"按钮看不出反应，且智能体的保存入口被错误浮层遮蔽；
3. 「LLM 模型管理」页面首次加载和切换 tab 出现明显卡顿；
4. 管理端整体页面切换有明显卡顿；
5. 缺失前端运行时性能埋点，无法定量判断是否解决。

整改后管理端应满足：登录后第一时间看到真实事件流；智能体详情页可正常进入、可正常保存基础/模型/知识库/关联四类配置；LLM 模型管理页保持流畅；切页无明显卡顿；具备前端性能埋点用于回归。

## 2. Glossary

| 术语 | 含义 |
|---|---|
| 管理端 | `frontend-admin`，Vue 3 + Vite + Element Plus 单页应用 |
| 仪表盘 | `/dashboard` 路由的 `DashboardPage.vue` |
| 智能体详情页 | `/agents/:id` 或 `/agents/new` 路由的 `AgentDetailPage.vue` |
| LLM 模型管理页 | `/llm-models` 路由的 `LlmModelsManagementPage.vue` |
| 切页 | vue-router 在同一 layout 内切换子路由的过程 |
| 最近活动 | 仪表盘上的系统动态时间线，来源是 `audit_events` 表 + 各模块产生的审计事件 |
| 审计事件 | 由用户/系统在受控操作（创建/更新/删除/启停/测试/解析完成）后写入的统一记录 |
| SSE | Server-Sent Events，基于 HTTP 长连接的服务器主动推送 |
| EP | Element Plus |
| KPI 卡片 | Dashboard 上方的总用户数/监控任务/今日舆情/系统告警 4 张 StatCard |
| ECharts | Apache ECharts 图表库，本期项目 dashboard 上有两个图（趋势折线、平台分布饼图） |

## 3. Requirements

### REQ-1 仪表盘最近活动是真实后台事件

**User Story**: AS 管理员，I WANT 在登录后第一时间看到真实的系统事件流，SO THAT 我能判断平台当前是否正常运行。

**Acceptance Criteria**:

1. WHEN 管理员登录管理端并进入 `/dashboard`，THE 管理端 SHALL 在 1 秒内向 `/api/admin/dashboard/recent-activities` 发起请求并以返回数据渲染最近活动列表。
2. WHEN 仪表盘最近活动接口成功返回，THE 仪表盘 SHALL 展示来自 `audit_events` 表中按时间倒序、限定条数（默认 20 条）的记录，并标注 `time / type / module / title`。
3. IF 后端接口 2 秒内未返回，THE 仪表盘 SHALL 保留上一次成功返回的数据并静默重试，UI 上不显示错误提示。
4. WHILE 仪表盘处于活跃状态，THE 管理端 SHALL 通过 SSE 订阅 `admin:dashboard:activity` 频道并把新事件合并入最近活动列表（最多保留 20 条）。

### REQ-2 仪表盘 KPI 与图表实时

**User Story**: AS 管理员，I WANT 仪表盘 4 张 KPI 与两张图表显示真实数据，SO THAT 我能监控平台真实运行状态。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/dashboard`，THE 管理端 SHALL 调用 `/api/admin/dashboard/overview` 一次性获取 KPI 数（总用户数、监控任务数、今日舆情数、未处理告警数、活跃智能体数）、近 7 天舆情序列、平台分布 TopN。
2. WHEN `/api/admin/dashboard/overview` 返回 200，THE 仪表盘 SHALL 用返回数据填充 KPI 卡片与两个图表，不留 `-` 占位。
3. WHILE `setInterval(60_000)` 定时器在仪表盘存活期间，THE 管理端 SHALL 每 60 秒重新拉取一次 `/admin/dashboard/overview` 并就地把图表与 KPI 卡片刷新。
4. IF 图表容器在视口外，THE 仪表盘 SHALL 跳过定时刷新以避免无意义的 ECharts 重绘开销。

### REQ-3 新增审计事件统一表

**User Story**: AS 平台维护者，I WANT 引入一张轻量的 `audit_events` 表统一采集关键操作，SO THAT 多个上层特性（最近活动、行为回溯、运维审计）可以复用同一数据源。

**Acceptance Criteria**:

1. THE 后端 SHALL 新增 `audit_events` 表（id / tenantId 可选 / actorId / actorType / module / action / resourceType / resourceId / title / content / ip / createdAt），并通过 TypeORM migration 同步生成。
2. WHEN 任一受控接口（创建/更新/删除/启停智能体、创建/禁用 LLM 模型、创建/更新用户、解析完成知识库、登录登出等）完成，THE 后端 SHALL 在该接口的成功路径上写入一条 `audit_events` 记录。
3. THE 后端 SHALL 在 `audit_events` 表的 `createdAt` 上建立索引以支撑时间倒序查询。
4. IF 写入 `audit_events` 失败，THE 后端 SHALL 记录 warn 日志而不影响主业务接口的响应结果。

### REQ-4 实时通道与前端订阅

**User Story**: AS 管理员，I WANT 后端写入审计事件后页面立即看到，SO THAT 我能捕捉到刚发生的动作而不需要手动刷新。

**Acceptance Criteria**:

1. WHEN 后端任一受控接口写入 `audit_events` 成功，THE 后端 SHALL 通过已有的 Realtime Gateway 向 `admin:dashboard:activity` 频道发布事件，事件载荷包含 id/module/title/createdAt/type。
2. WHEN 仪表盘 SSE 订阅启动，THE 后端 SHALL 返回 `text/event-stream` 响应并以心跳（每 25 秒）维持连接。
3. IF 浏览器 SSE 连接断开，THE 管理端 SHALL 在 5 秒后自动重连并恢复订阅。

### REQ-5 智能体详情页 SFC 编译无错

**User Story**: AS 管理员，I WANT 进入 `/agents/:id` 或 `/agents/new` 时不出错，SO THAT 我能正常编辑或创建智能体。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/agents/new` 或 `/agents/:id`，THE Vite SHALL 成功编译 `AgentDetailPage.vue` 不在浏览器触发 [plugin:vite:vue] error overlay。
2. THE 管理端 SHALL 把 `AgentDetailPage.vue` 知识库选择区（KB 标签页）重构为 `el-checkbox-group` 包裹多行 `el-checkbox` 的写法，移除"独立 `el-checkbox` 上同时使用 `v-model`+`:value`"的写法。
3. WHEN 详情页加载完成，THE 管理端 SHALL 自动调用 `GET /api/agents/:id`、`GET /api/admin/llm-models`、`GET /api/admin/knowledge/available`，并把数据回填到表单。

### REQ-6 智能体编辑保存全可用

**User Story**: AS 管理员，I WANT 在智能体详情页能保存基础配置、模型设置、知识库设置、知识库关联四类信息，SO THAT 智能体可立即被其他模块复用。

**Acceptance Criteria**:

1. WHEN 管理员点击"保存基础配置"，THE 管理端 SHALL 校验通过后调用 `POST /api/agents`（新建）或 `PUT /api/agents/:id`（更新），成功后用 `ElMessage.success` 反馈。
2. WHEN 管理员点击"保存模型设置"，THE 管理端 SHALL 调用 `PUT /api/agents/:id` 仅带上 `primaryModelId`、`fallbackModelIds` 两个字段。
3. WHEN 管理员点击"保存知识库设置"，THE 管理端 SHALL 调用 `PUT /api/agents/:id` 带上 `kbEnabled`、`kbTopK`。
4. WHEN 管理员点击"保存关联"，THE 管理端 SHALL 调用 `POST /api/admin/agents/:id/knowledge-bases` 携带勾选的 `kbIds`。
5. THE 管理端 SHALL 新增"保存全部"按钮，一次提交基础配置/模型/知识库/关联的所有变更，减少按钮心智负担。
6. IF 任何保存接口报错，THE 管理端 SHALL 弹错误提示并保留已填字段不变。

### REQ-7 智能体创建跳转可靠

**User Story**: AS 管理员，I WANT 创建智能体成功后跳转到详情页，SO THAT 继续配置主用模型、知识库等。

**Acceptance Criteria**:

1. WHEN `POST /api/agents` 返回 201，THE 后端 SHALL 保证响应体含 `id` 字段（数字类型）。
2. WHEN 后端响应缺少 `id`，THE 前端 SHALL 抛错并弹错误提示，停留在当前页不跳转。
3. WHEN 后端响应包含 `id`，THE 前端 SHALL 调用 `router.push('/agents/' + id)` 完成跳转，跳转后页面 SHALL 命中 `REQ-5`。

### REQ-8 LLM 模型管理页流畅

**User Story**: AS 管理员，I WANT LLM 模型管理页在 100 条模型下首屏 ≤ 800ms、tab 切换 ≤ 100ms，SO THAT 配置 LLM 不影响日常管理效率。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/llm-models`，THE 管理端 SHALL 调用 `/api/admin/llm-models?page=1&pageSize=20` 一次性拉取前 20 条（不一次性拉 100 条）。
2. WHEN 管理员切到任一厂商 tab，THE 管理端 SHALL 在不重新调用接口的前提下用客户端缓存切换展示数据，切 tab 渲染耗时 ≤ 100ms。
3. THE 管理端 SHALL 把 `countByProvider`、`tableData.filter(...)` 这类派生态从 render 期的 inline 表达式改为 `computed`，且首次计算结果 SHALL 被 `Object.groupBy` 拆分缓存。
4. THE `el-tabs` SHALL 设置 `:lazy="true"`，使非首屏 tab 不在 mount 时挂载。
5. WHEN 用户在搜索框输入文本，THE 管理端 SHALL 在 300ms 防抖后调用 `/api/admin/llm-models?search=...` 重拉服务端数据。
6. THE `ModelsTable.vue` SHALL 使用 `el-table :row-key="(row)=>row.id"` 并保留 stripe 风格；操作列 SHALL 抽到 `el-dropdown` 减少单行 ref 数。

### REQ-9 Element Plus 按需引入

**User Story**: AS 平台维护者，I WANT Element Plus 改为按需引入，SO THAT 管理端首屏 JS 体积减小、切页更快。

**Acceptance Criteria**:

1. THE `frontend-admin/src/main.ts` SHALL 移除 `app.use(ElementPlus)` 全量注册，改为白名单 `app.use(...)` 注册本项目实际用到的 EP 组件。
2. THE Vite 配置 SHALL 设置 `optimizeDeps.include` 包含按需引入的 EP 组件包路径。
3. THE 管理端首屏 gzip 后体积 SHALL 比改造前降低 ≥ 30%。

### REQ-10 ECharts 按需引入并预留扩展

**User Story**: AS 平台维护者，I WANT ECharts 改成模块化按需引入且可被后续页面扩展复用，SO THAT 图表功能可低成本增加。

**Acceptance Criteria**:

1. THE `DashboardPage.vue` SHALL 仅 `import { LineChart, PieChart } from 'echarts/charts'` 等必要子模块，不引入全量 `echarts`。
2. THE 前端 SHALL 在 `frontend-shared` 或 `frontend-admin/src/utils` 下封装一份 `createChart(el, type, option)` 工具，后续其它页面复用同一工具以避免重复打包。
3. THE `echarts` 在 vite `manualChunks` 中 SHALL 独立为 `echarts` chunk，与 EP 等 chunk 互不污染。

### REQ-11 路由切换走 keep-alive

**User Story**: AS 管理员，I WANT 频繁访问的页面（仪表盘、Agent 列表、LLM 模型、知识库、系统日志）切换时不再重绘图表与表单，SO THAT 切页体感顺滑。

**Acceptance Criteria**:

1. THE `AdminLayout.vue` SHALL 在 `<router-view>` 外层包一层 `<keep-alive :include="[...]">`。
2. THE include 列表 SHALL 至少包含 `DashboardPage`、`AgentsPage`、`LlmModelsManagementPage`、`KnowledgeBasesPage`、`SystemLogsPage`。
3. WHEN 管理员在上述页面之间切换，THE ECharts 实例 SHALL 不被销毁，切回时不需要重新 `init`。
4. IF 某次需求变更必须强制重建（如登出后回到登录页），THE 前端 SHALL 通过 `nextTick` 后调用 `keep-alive` 的 `refresh` 触发对应页面重载。

### REQ-12 全局样式与渲染优化

**User Story**: AS 平台维护者，I WANT 管理端玻璃拟态样式不影响交互性能，SO THAT 在中低端机上仍可用。

**Acceptance Criteria**:

1. THE `AdminLayout.vue` 侧栏 SHALL 默认不启用 `backdrop-filter: blur(...)`，仅在 hover 子菜单时启用。
2. THE AdminLayout 路由菜单 SHALL 移除 `<router-link custom v-slot>` 嵌套 `<div>` 的写法，改为直接 `<div @click="router.push(item.path)">` + 自行维护 active class。
3. THE `AdminLayout.vue` 顶部硬编码的 `<el-icon class="admin-topbar__toggle"><Expand v-if="false" /></el-icon>` SHALL 改为可在运行时切换的折叠图标。

### REQ-13 前端性能埋点

**User Story**: AS 平台维护者，I WANT 前端关键路径打点（首屏、切页、详情进入、ECharts init），SO THAT 后端能采集真实性能基线并支持回归对比。

**Acceptance Criteria**:

1. THE 管理端 SHALL 在以下时机使用 `performance.mark` + `performance.measure` 记录耗时指标并通过 `navigator.sendBeacon` 上报到 `/api/admin/front-metrics`：
   - 首屏 FCP（首次内容绘制）；
   - 路由切换耗时（路由 beforeEach → afterEach）；
   - 详情页 mount 到首屏可交互；
   - ECharts 实例 `init` 耗时。
2. WHEN 接口失败或浏览器不支持 beacon，THE 管理端 SHALL 降级为 `fetch keepalive` 上报；仍失败则本地 console.warn 并丢弃。
3. THE 后端 SHALL 把前端上报的指标落入 `system_logs` 的新 level（`frontend-perf`），不直接落库到 `audit_events`。

### REQ-14 文档与回归

**User Story**: AS 维护者，I WANT 本次整改以可追溯的方式落地，SO THAT 后续人员可理解每条改动。

**Acceptance Criteria**:

1. THE 仓库根 SHALL 新增 `.monkeycode/specs/260714-fix-admin-experience/requirements.md`、`design.md`、`tasklist.md` 三份文档。
2. THE 后续实施 SHALL 严格按 tasklist 顺序执行，每个任务完成后 SHALL 给出可独立验证的验收点。
3. THE 任务完成 SHALL 不修改任何 `.env`、不打印任何密钥、不向用户项目代码写入 Agent 环境中的 LLM Key。
