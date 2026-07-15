# 3 项问题整改方案

## 问题 1：管理端热点话题页面无内容

**根因**：管理端 `HotTopicsPage.vue` 调用 `GET /api/hot-topics`（监控任务热点），数据库无事件数据时返回空列表。而平台热点数据在 `GET /api/hot-topics/platform`（60s.viki.moe 聚合 API）中，管理端未使用。

**修复方案**：

| 改动 | 说明 |
|------|------|
| `admin/.../HotTopicsPage.vue` | 重写为与用户端相同的双 Tab 结构：Tab1=平台热点（9 平台实时榜单）、Tab2=任务热点（现有逻辑） |
| 默认展示 | 默认 Tab1 平台热点，立即显示 258 条实时数据 |

## 问题 2：管理端无工单处理系统

**根因**：管理端 `WorkOrdersPage.vue` 实际已存在完整功能（新建/回复/完结/评分），但菜单项不够突出或用户未找到。

**修复方案**：
- 确认 `AdminLayout.vue` 中工单菜单项位置
- 将菜单项移至"运营管理"分组前三位
- 确保空状态引导清晰（"暂无工单，点击新建工单创建"）

## 问题 3：知识图谱 LLM 模型配置

**需求**：管理端可配置知识图谱使用的主模型 + 最多 5 个备用模型，模型来源于管理端 LLM 列表。

**方案**：

### 新增页面：`KnowledgeGraphConfigPage.vue`

```
管理端 → 系统配置 → 知识图谱配置
```

配置项：

| 配置 | 类型 | 说明 |
|------|------|------|
| 主模型 | 下拉选择 | 从 `GET /api/admin/llm-models` 中已启用的模型列表选取 |
| 备用模型 1-5 | 多选下拉 | 最多选 5 个，主模型不可用时按序切换 |
| 自动提取 | 开关 | 是否自动从监控事件中提取知识图谱 |
| 提取频率 | 下拉 | 每 6h/12h/24h |

### 存储方式
- 新增 `kg_config` 表或使用 `knowledge_graph_config` 实体
- 最简单的方案：使用现有 `LlmModelEntity` 的 `isEnabled` 字段，加上新字段 `isKgFallback: boolean`

### 后端改动

| 文件 | 说明 |
|------|------|
| `llm-models.entity.ts` | 新增 `isKgPrimary` 和 `isKgFallback` 字段 |
| `llm-models.controller.ts` | 新增 `PUT :id/kg-config` 端点 |
| `knowledge-graph.service.ts` | 从 `LlmModelEntity` 查询主/备模型 |
| `knowledge-graph.controller.ts` | `active-model` 端点返回主+备模型列表 |

### 前端改动

| 文件 | 说明 |
|------|------|
| `KnowledgeGraphConfigPage.vue` | 新建配置页 |
| `admin router` | 新增路由 `/config/knowledge-graph` |
| `admin AdminLayout` | 新增菜单项 |
| `KnowledgeGraphPage.vue`(admin+user) | 显示主模型+备用模型标签 |

---

## 改动清单

| 文件 | 改动 |
|------|------|
| `frontend-admin/.../HotTopicsPage.vue` | 重写为双 Tab（平台热点+任务热点） |
| `frontend-admin/.../WorkOrdersPage.vue` | 空状态引导优化 |
| `backend/.../llm-models.entity.ts` | 新增 `isKgPrimary`/`isKgFallback` |
| `backend/.../knowledge-graph.service.ts` | 使用 LLM 主/备配置 |
| `backend/.../knowledge-graph.controller.ts` | 返回主+备模型列表 |
| `frontend-admin/.../KnowledgeGraphConfigPage.vue` | **新建** |
| `frontend-admin/.../router/index.ts` | 新增路由 |
| `frontend-admin/.../AdminLayout.vue` | 新增菜单项 |
| `frontend-admin/.../KnowledgeGraphPage.vue` | 显示主/备模型 |
| `frontend-user/.../KnowledgeGraphPage.vue` | 显示主/备模型 |

---

确认后开始实施。
