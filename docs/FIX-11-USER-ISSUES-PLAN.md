# 用户端 11 项问题全面整改方案

## 问题排查结果

| # | 问题 | 根因 | 修复方案 | 工作量 |
|---|------|------|----------|--------|
| 1 | 导航栏图标文字挤在一起 | 16 个菜单项横向排列，容器宽度不足 | 改为两行自适应布局 + `flex-wrap` + 图标文字间距调整 | 1h |
| 2 | AI公关（/pr）无反应 | `PrReportsPage.vue` 存在但首屏加载可能报错 | 排查控制台错误，确保初始数据加载不崩溃 | 0.5h |
| 3 | 竞品对比无添加入口 | 用户未创建监控任务，页面缺少空状态引导 | 增加空状态提示 + "创建监控任务"引导按钮 | 0.5h |
| 4 | 多维对比无反应 | Vite 编译错误：`description="配置对比条件后点击"开始对比""` 双引号未转义 | 改用单引号或 `:description="..."` | 0.1h |
| 5 | 热点话题无数据 | 页面缺少 mock 降级 + 空状态提示 | 增加 mock 数据回退 + 空状态引导 | 1h |
| 6 | 短视频无添加入口 | 同 #3，无监控任务时无内容 | 增加空状态提示 + 引导创建监控任务 | 0.5h |
| 7 | 自定义面板 500 错误 | `GET /api/dashboards` 返回 500 | 修复后端 DashboardController 异常 | 1h |
| 8 | 工单缺少功能 | 用户端仅可读 + 评论，无提交/处理/评分；管理端同样缺少 | 用户端：新增提交工单、完结评分；管理端：新增回复工单、完结、评分 | 4h |
| 9 | 知识图谱无反应 | Vue 编译错误：`loadMockGraph()` 缺少 `async` | 加 `async` 关键字 | 0.1h |
| 10 | 监控任务创建引导不明确 | 多处功能首次进入无引导 | 新增 `EmptyStateGuide` 组件，统一引导 | 2h |
| 11 | 实名认证跳转首页 | `onMounted(loadStatus)` 检测已认证后跳 `/dashboard` | 用户未认证时不强制跳转 | 0.3h |

---

## 详细修复

### 1. 导航栏 UI 优化
- `UserLayout.vue`: 将 `display: grid; grid-template-columns: 240px 1fr auto` 改为自适应
- `user-nav` 添加 `flex-wrap: wrap; gap: 4px` 允许换行
- 增大导航项间距，图标和文字间距统一为 `gap: 6px`
- 响应式：窗口变窄时导航自动换行，不挤压文字
- 参照 Element Plus 官方导航设计规范

### 4. 多维对比引号修复
```vue
<!-- 修改前 -->
<el-empty description="配置对比条件后点击"开始对比"">

<!-- 修改后 -->
<el-empty description="配置对比条件后点击「开始对比」">
```

### 7. 自定义面板 500 修复
- `GET /api/dashboards` 后端需要检查用户是否有仪表盘
- 当用户无仪表盘时返回空数组而非报错
- 前段增加空状态提示

### 9. 知识图谱 async 修复
```typescript
// 修改前
function loadMockGraph(): void { ... await nextTick() ... }

// 修改后
async function loadMockGraph(): Promise<void> { ... await nextTick() ... }
```

### 10. 统一空状态引导
新建组件 `EmptyStateGuide.vue`，在以下场景复用：
- 竞品对比：未创建监控任务时显示引导
- 短视频监控：未创建监控任务时显示引导  
- 热点话题：无数据时显示引导
- 知识图谱：无数据时显示引导

### 11. 实名认证跳转
- `loadStatus` 中仅当用户确实已认证时才跳转 `/dashboard`
- 区分"从未认证"和"认证成功"两个场景

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `frontend-user/.../UserLayout.vue` | 导航栏 CSS 重写 |
| `frontend-user/.../ComparisonPage.vue` | 修复引号 |
| `frontend-user/.../KnowledgeGraphPage.vue` | 加 async |
| `frontend-user/.../RealNameVerifyPage.vue` | 修复跳转逻辑 |
| `frontend-user/.../CompetitorPage.vue` | 空状态引导 |
| `frontend-user/.../ShortVideoPage.vue` | 空状态引导 |
| `frontend-user/.../HotTopicsPage.vue` | mock 降级 |
| `frontend-user/.../WorkOrdersPage.vue` | 提交/回复/完结/评分 |
| `frontend-admin/.../WorkOrdersPage.vue` | 回复/完结/分配/评分 |
| `backend/.../dashboard.controller.ts` | 修复 500 |
| `frontend-user/.../components/EmptyStateGuide.vue` | 新建通用引导组件 |

---

请确认后开始实施。
