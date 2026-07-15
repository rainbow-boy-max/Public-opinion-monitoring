# AI 编程 UI 设计必读文档 — 舆情监测系统

> 版本：1.0 | 适用：管理端（frontend-admin）& 用户端（frontend-user）
> 框架：Vue 3.5 + Vite 5 + Element Plus 2.14 + TypeScript 5.9

---

## 1. 设计原则

### 1.1 三断点响应

```
PC     ≥ 1024px    → 全功能布局，侧栏展开
平板   768-1023px  → 侧栏折叠，卡片 grid 减列，表格有水平滚动
手机   ≤ 767px     → 全单列，对话框全屏，操作栏收进更多按钮
```

### 1.2 CSS 变量主题

所有颜色 / 间距 / 圆角 / 模糊值统一从 `@shared/styles/theme.css` 的 `:root` 读取，不硬编码。

| 变量 | 用途 | 示例值 |
|---|---|---|
| `--glass-bg` | 卡片背景 | `rgba(30, 39, 80, 0.4)` |
| `--radius-md` | 卡片圆角 | `10px` |
| `--text-primary` | 主文本 | `#E8EBFF` |
| `--gap-md` | 间距 | `16px` |

---

## 2. 布局 (Layout)

### 2.1 管理端 AdminLayout

```
┌─────────────────────────────────────────────┐
│  sidebar (64px / 240px)  │  main            │
│                          │  ┌─ topbar ───┐  │
│  logo + collapse btn     │  │ title ↑    │  │
│  ┌─ nav ──────────┐      │  │ breadcrumb │  │
│  │ 概览           │      │  └────────────┘  │
│  │ LLM 模型       │      │  ┌─ content ──┐  │
│  │ AI 智能体      │      │  │            │  │
│  │ ...            │      │  │ router-view│  │
│  └────────────────┘      │  │            │  │
│  ┌─ user card ────┐      │  └────────────┘  │
│  │ admin 用户信息 │      │                  │
│  └────────────────┘      │                  │
└─────────────────────────────────────────────┘
```

#### 侧栏宽度
```vue
<el-aside :width="isCollapsed ? '64px' : '240px'" class="admin-aside">
```

- 平板 & 手机：强制 `isCollapsed = true`，菜单 `display: none`，hover 弹出子菜单
- PC：用户可点折叠按钮切换

### 2.2 断点调整规则

#### PC (≥ 1024px)
- 侧栏默认展开 (240px)
- Dashboard 2 列 grid
- 表格常规列宽显示
- 对话框 `width="60%"`，最大 800px

#### 平板 (768-1023px)
- 侧栏折叠 (64px)
- Dashboard 单列
- el-table 启用 `max-height="60vh"` + 水平滚动
- 对话框 `width="90%"`

#### 手机 (≤ 767px)
- 侧栏自动折叠，菜单抽屉弹出
- Dashboard 单列，StatCard 2×2 grid
- 所有表格必须加 `overflow-x: auto`
- 操作按钮收进`<el-dropdown>` 更多
- 对话框全屏

---

## 3. Element Plus 组件适配规范

### 3.1 el-table 自适应

```vue
<el-table
  :data="items"
  stripe
  :max-height="isMobile ? '50vh' : undefined"
  style="width: 100%"
  @selection-change="onSelectChange"
>
```

- **必须**：`style="width: 100%"`
- **推荐**：高频操作列 `fixed="right"`
- **手机**：设 `max-height` 并允许多行 auto-wrap
- **手机**：操作按钮用 `el-dropdown` 收纳
- **禁止**：硬编码 `width="NNNNpx"`

### 3.2 el-dialog 弹窗

```vue
<el-dialog
  v-model="visible"
  :title="title"
  :width="dialogWidth"
  top="5vh"
>
```

```ts
// 响应式宽度
const dialogWidth = computed(() => {
  if (window.innerWidth <= 767) return '95%'
  if (window.innerWidth <= 1023) return '85%'
  return '60%'
})
```

- **手机**：`top="0"` + `width="100%"` + 有顶部拖拽条
- **平板**：`top="5vh"` + `width="85%"`
- **PC**：`width="60%"`，最大 800px

### 3.3 el-form 表单

```vue
<el-form
  :model="form"
  :rules="rules"
  :label-width="labelWidth"
  label-position="top"
>
```

- **手机**：`label-position="top"`（标签在上方）
- **PC**：`label-position="left"` + `label-width="140px"`
- 响应式 `labelWidth`：

```ts
const labelWidth = computed(() => {
  return window.innerWidth <= 767 ? '80px' : '140px'
})
```

### 3.4 el-tabs 标签页

- **手机**：`el-tabs` 加 `type="card"` 缩小标签
- **平板/PC**：默认 `type="border-card"`

### 3.5 el-pagination 分页

- **手机**：`layout="prev, pager, next"`（去掉 total/sizes/jumper）
- **PC**：全功能 `layout="total, sizes, prev, pager, next, jumper"`

### 3.6 el-card / GlassCard

- 所有卡片加 `overflow: hidden` + 内边距 `var(--gap-md)`
- 手机卡内文字 `14px`

---

## 4. 页面级自适应清单

### DashboardPage
```scss
.dashboard-stats {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
@include mobile {
  .dashboard-stats { grid-template-columns: 1fr 1fr; }  // 2×2
  .dashboard-row { grid-template-columns: 1fr; }
}
```

### LlmModelsManagementPage
- 操作列 `fixed="right"`
- **手机**：表格内能力标签缩短为图标
- **平板+**：能力标签用文字（📷 vision）

### AgentsPage
- 卡片 grid：PC 3 列 / 平板 2 列 / 手机 1 列
```scss
.agent-grid {
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
}
@include mobile {
  .agent-grid { grid-template-columns: 1fr; }
}
```

### KnowledgeBaseDetailPage
- `/knowledge/:id` 的文件表 + 预览 dialog
- 预览 dialog 手机全屏
```vue
<el-dialog v-model="previewVisible" title="预览" :width="dialogWidth" top="5vh">
```

### LoginPage
- 双栏 → 单栏
```scss
.login-container {
  grid-template-columns: 1fr 1fr;
  max-width: 1100px;
}
@include mobile {
  .login-container { grid-template-columns: 1fr; }
  .login-brand__features { display: none; }
}
```

---

## 5. 工具类 / Mixins

在 `frontend-admin/src/utils/responsive.ts` 创建：

```ts
import { ref, onMounted, onUnmounted } from 'vue'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const bs = ref<Breakpoint>('desktop')

function getBreakpoint(w: number): Breakpoint {
  if (w <= 767) return 'mobile'
  if (w <= 1023) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const onResize = () => { bs.value = getBreakpoint(window.innerWidth) }
  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
  })
  onUnmounted(() => window.removeEventListener('resize', onResize))
  return { breakpoint: bs, isMobile: computed(() => bs.value === 'mobile'),
           isTablet: computed(() => bs.value === 'tablet'),
           isDesktop: computed(() => bs.value === 'desktop') }
}
```

---

## 6. 已存在的待修复项

| 文件 | 问题 | 修复 |
|---|---|---|
| `LlmModelsManagementPage.vue` | 编辑 dialog width=760 硬编码 | 改为 `:width="dialogWidth"` |
| `KnowledgeBasesPage.vue` | 创建 dialog width=640 | 同上 |
| `SmsTemplatesPage.vue` | 编辑 dialog width=720 | 同上 |
| `UserManagementPage.vue` | 详情/新增/重置 dialog width 固定 | 同上 |
| `AdminLayout.vue` | 侧栏 `backdrop-filter` 手机卡顿 | 手机去掉 blur 效果 |
| 所有表格 | PC `overflow-x` 无 .el-table__body-wrapper | 已有 `overflow-x: auto` |
| `/agents` 卡片 grid | minmax(380px) 手机过大 | 改为 `minmax(280px, 1fr)` |
| `/dashboard` row | grid 2fr 1fr 手机不适用 | `@media ≤767px` 改为单列 |
| `/knowledge` 卡片 grid | minmax(360px) 手机过大 | 改为 `minmax(260px, 1fr)` |

---

## 7. 验收标准

| 测试场景 | 预期 |
|---|---|
| iPhone SE (375px) 打开管理端 | 登录页单栏、侧栏折叠、所有数据在视口内 |
| iPad (768px) 横屏 | 侧栏折叠、表格水平滚动、dialog 85% 宽 |
| MacBook (1440px) | 全功能 layout、侧栏展开、dialog 60% 宽 |
| Chrome DevTools 所有断点 | 无内容溢出、无重叠、无水平滚动超出 |
| 对话框在手机上 | 全屏、拖拽条明显、可点击外部关闭 |

---

## 8. 编码规范

```scss
// 全局 mixin 统一断点（响应式文件建议集中管理）
@mixin mobile { @media (max-width: 767px) { @content; } }
@mixin tablet { @media (min-width: 768px) and (max-width: 1023px) { @content; } }
@mixin desktop { @media (min-width: 1024px) { @content; } }
```

优先级：
1. 优先用 CSS Grid `auto-fill` + `minmax` 实现自适应
2. 其次用 `@media` 断点覆盖
3. 避免 JS 监听 resize（除 dialog 宽度等不可替代场景）
