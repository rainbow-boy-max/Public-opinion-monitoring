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

- [x] 4. 检查点：B 包验收（人工 + 浏览器）

- [x] 5. 后端：建表与实体
- [x] 6. 后端：`audit.service` 写入工具
- [x] 7. 后端：在受控接口的成功路径上调用 `audit.record(...)`
- [x] 8. 后端：dashboard 聚合接口
- [x] 9. 前端：`DashboardPage.vue` 接入新接口
- [x] 10. 检查点：A 包验收

- [x] 11. `LlmModelsManagementPage.vue` 拆分 `computed` + 减少重算
- [x] 12. tab `lazy` + 不重拉
- [x] 13. 搜索 + 服务端分页
- [x] 14. `ModelsTable.vue` 行级优化
- [x] 15. 检查点：C 包验收（性能）

- [x] 16. Element Plus 按需引入
- [x] 17. ECharts 按需 + 工具封装
- [x] 18. `vite.config.ts` 拆 chunk
- [x] 19. 路由 keep-alive
- [x] 20. `AdminLayout.vue` 样式与菜单渲染优化
- [x] 21. 检查点：D 包验收

- [x] 22. `frontend-admin/src/utils/perf-metrics.ts`
- [x] 23. 接入关键路径
- [x] 24. 后端：`POST /admin/front-metrics`
- [x] 25. 检查点：E 包验收
- [x] 26. 全量回归（commit 55d8d53 已落，待人工回归）
- [x] 27. 文档收口
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
