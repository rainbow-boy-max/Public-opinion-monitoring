# 需求实施计划：admin-experience-fix（260714）

> 文档基线：`.monkeycode/specs/260714-fix-admin-experience/requirements.md` + `design.md`
> 优先级与依赖：`B → A → C → D → E`，B 必须先做以解除详情页编译红屏造成的整个右侧交互被锁。
> 任务标 `*` 的为可选任务（测试 / 文档 / 验收脚本），实施时跳过。

## 1. 工作包 B：智能体详情页编译 / 编辑 / 创建修复

- [x] 1. 重写 `frontend-admin/src/pages/AgentDetailPage.vue` 知识库选择区为 `el-checkbox-group` 写法
  - 替换第 169–193 行的 `<label v-for>` + `<el-checkbox v-model :value />` 结构为 `<el-checkbox-group v-model>` + 子 `<el-checkbox :value="kb.id">`
  - 保留 `:class="{ 'kb-select-card--selected': form.knowledgeBaseIds.includes(kb.id) }"` 的选中态
  - 验证：`pnpm -C frontend-admin build` 无 [plugin:vite:vue] Unexpected token；浏览器进入 `/agents/new` 与 `/agents/1` 都不出现 vite error overlay
  - 关联：REQ-5

- [x] 2. 增加"保存全部"入口，合并四类保存
  - 在 `el-tabs` 顶部新增 `<el-button type="primary" plain @click="onSaveAll">保存全部</el-button>`
  - `onSaveAll()` 顺序执行 `onSave` / `onSaveModels` / `onSaveKb`，聚合成功/失败反馈；任一失败不中断，但提示哪一步没保存成功
  - 关联：REQ-6.5

- [x] 3. 修正创建跳转路由
  - 在 `AgentDetailPage.vue` 的 `onSave()` 内，`POST /agents` 成功后读取 `r?.id ?? r?.agentId ?? r?.data?.id` 三段兼容；`r?.id` 仍为空时 `ElMessage.error('创建成功但未返回 id')` 并停留
  - `onSaveAll()` 同样使用三段兼容，并补上 knowledge-bases 关联保存步骤
  - 关联：REQ-7

- [ ] 4. 检查点：B 包验收（人工 + 浏览器）
  - 浏览器手测：登录 → 进 `/agents/new` → 填写 name/role/温度 → 点"保存基础配置"→ 跳到 `/agents/:id` → 进"知识库"tab → 勾选一个 KB → 点"保存关联" → 进"测试运行"标签可输入并运行
  - 通过条件：浏览器 console 0 红、Network 全 2xx

## 5. 工作包 A：仪表盘实时数据 + `audit_events` 轻量表 + SSE

- [x] 5. 后端：建表与实体
- [x] 6. 后端：`audit.service` 写入工具
- [x] 7. 后端：在受控接口的成功路径上调用 `audit.record(...)`
- [x] 8. 后端：dashboard 聚合接口
- [x] 9. 前端：`DashboardPage.vue` 接入新接口
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

- [x] 11. `LlmModelsManagementPage.vue` 拆分 `computed` + 减少重算
- [x] 12. tab `lazy` + 不重拉
- [x] 13. 搜索 + 服务端分页
- [x] 14. `ModelsTable.vue` 行级优化
- [ ] 15. 检查点：C 包验收（性能）

- [x] 16. Element Plus 按需引入
- [x] 17. ECharts 按需 + 工具封装
- [x] 18. `vite.config.ts` 拆 chunk
- [x] 19. 路由 keep-alive
- [x] 20. `AdminLayout.vue` 样式与菜单渲染优化
- [ ] 21. 检查点：D 包验收

- [x] 22. `frontend-admin/src/utils/perf-metrics.ts`
- [x] 23. 接入关键路径
- [x] 24. 后端：`POST /admin/front-metrics`
- [ ] 25. 检查点：E 包验收
- [ ] 26. 全量回归
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
