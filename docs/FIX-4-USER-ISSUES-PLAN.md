# 系统问题全面整改方案

## 问题 1：系统日志未完整记录管理员操作

**根因**：`@AuditLog` 装饰器仅加到了 `AdminController` 的 8 个方法，其他管理端控制器（监测任务、知识库、智能体、预警中心、LLM模型、搜索配置、短信模板、打分配置等）均未接入审计日志。

**修复方案**：

| 控制器 | 操作 | 需添加装饰器数 |
|--------|------|---------------|
| `MonitorTasksController` | 创建/更新/删除/暂停/启用任务 | 5 |
| `KnowledgeBasesController` | 创建/更新/删除知识库、文件 | 6 |
| `AgentsController` | 创建/更新/删除智能体 | 4 |
| `AlertController` | 创建/更新/删除/开关预警规则 | 5 |
| `AdminController` | ⚠️ `deleteUser` 的 `@AuditLog` 已在但未显示 | 排查拦截器兼容性 |
| `LlmModelsController` | 批量操作、切换启用 | 3 |

---

## 问题 2：用户端无法用管理端创建的用户登录

**根因**：管理端创建用户时默认 `authStatus = 'unverified'`，用户端登录后路由守卫检测到未认证，强制跳转到 `/verify` 页面。用户认为"登录失败"，实际是被重定向到认证页卡住了。

**修复方案**：在管理端创建用户时，设置 `authStatus = 'verified'`（管理员直接创建的用户应由管理员保证可信）。

---

## 问题 3：用户端登录后不跳转页面

**根因同上**：登录成功后被重定向到 `/verify` 页面，用户看到认证页面以为登录没有跳转。

**修复方案**：在用户端 `LoginPage.vue` 中增加登录后的 `authStatus` 判断处理：
- 若 `verified` → `/dashboard`
- 若 `unverified` → `/verify`（当前行为，但需用户明确看到提示）
- 新增 Toast 提示："登录成功，请先完成实名认证"

---

## 问题 4：管理端用户管理页面不显示用户类型（角色）

**根因**：`UserManagementPage.vue` 的 `el-table` 列定义中缺少 `role` 列。后端 API 已返回 `role` 字段，前端未渲染。

**修复方案**：在 ID 列之后、用户名之前插入角色列，用彩色 tag 显示（admin=红色、user=蓝色、operator=绿色）。

---

## 改动范围

| 文件 | 改动 |
|------|------|
| `frontend-admin/.../UserManagementPage.vue` | 新增 `role` 列 |
| `frontend-user/.../LoginPage.vue` | 登录后提示优化 |
| `backend/.../admin.controller.ts` | 修改 `createUser` 默认 `authStatus='verified'` |
| `backend/.../monitor-tasks.controller.ts` | +@AuditLog |
| `backend/.../knowledge-bases.controller.ts` | +@AuditLog |
| `backend/.../agents.controller.ts` | +@AuditLog |
| `backend/.../alert.controller.ts` | +@AuditLog |
| `backend/.../llm-models.controller.ts` | +@AuditLog |

---

确认后开始实施。
