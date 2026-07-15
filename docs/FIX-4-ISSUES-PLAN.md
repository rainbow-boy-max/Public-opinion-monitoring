# 问题修复方案

## 问题 1：系统日志未记录操作

**根因**：`@AuditLog` 装饰器和 `AuditInterceptor` 已存在，但未在任何 Controller 方法上使用。

**修复方案**：为 `AdminController` 中所有关键操作添加 `@AuditLog` 装饰器：

| 方法 | 模块 | 操作 |
|------|------|------|
| `createUser` | users | create |
| `banUser` / `unbanUser` | users | ban / unban |
| `resetPassword` | users | reset_password |
| `saveSmsConfig` / `saveVerifyConfig` | config | update |
| `saveTtsConfig` | config | update |
| `saveWebSearchConfig` | config | update |

**改动文件**：`admin.controller.ts`（20 处新增装饰器），`audit.module.ts`（确保 `AuditInterceptor` 全局注册）

---

## 问题 2：竞品组无法修改/保存/删除

**根因**：前端 `saveGroup()` 始终调用 `http.post()` 创建新组，未区分新建/编辑模式；无删除按钮。

**修复方案**：

| 场景 | 当前 | 修复后 |
|------|------|--------|
| 新建 | `POST /competitor/groups` | 保持不变 |
| 编辑 | ❌ 无此功能 | `PUT /competitor/groups/:id` |
| 删除 | ❌ 无此功能 | `DELETE /competitor/groups/:id` |

**改动文件**：`CompetitorTrackingPage.vue` - saveGroup 方法增加编辑分支；增加删除按钮

---

## 问题 3：品牌声誉按钮图标错误

**根因**：`icon="DataAnalysis"` 不是 Element Plus 图标名称。

**修复方案**：替换为有效图标名：
- `DataAnalysis` → `TrendCharts` 或移除 icon 属性使用纯文本
- `Download` 是有效图标，可以保留

**改动文件**：`BrandReputationPage.vue`

---

## 问题 4：知识图谱页面 Vite 编译报错

**根因**：`loadMockGraph()` 函数未标记为 `async`，但内部使用了 `await nextTick()`（第 309 行）。

```
[vue/compiler-sfc] Unexpected reserved word 'await'. (215:2)
```

**修复方案**：
```typescript
// 修改前
function loadMockGraph(): void { ... await nextTick() ... }

// 修改后
async function loadMockGraph(): Promise<void> { ... await nextTick() ... }
```

**改动文件**：`KnowledgeGraphPage.vue` 第 188 行

---

## 改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `backend/.../admin.controller.ts` | 修改 | 新增 20+ `@AuditLog` 装饰器 |
| `backend/.../audit/audit.module.ts` | 修改 | 确保拦截器全局注册 |
| `frontend-admin/.../CompetitorTrackingPage.vue` | 修改 | saveGroup 编辑分支 + 删除按钮 |
| `frontend-admin/.../BrandReputationPage.vue` | 修改 | 修复图标名 |
| `frontend-admin/.../KnowledgeGraphPage.vue` | 修改 | 加 async 到 loadMockGraph |
