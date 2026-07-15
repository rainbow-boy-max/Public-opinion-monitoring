# 3 项问题整改方案

## 问题 1：知识图谱模型配置保存报错

**根因**：后端 DTO 使用 `@IsInt({ each: true })` 严格校验 `fallbackModelIds` 每个元素必须为 `number` 类型。但从前端提交时，`el-select` 多选组件的 `v-model` 可能输出 `string[]`（JSON 序列化后数值被转为字符串）。

**修复**：在 DTO 中添加 `@Type(() => Number)` 类型转换装饰器，将字符串自动转为数字。

```typescript
// llm-models.controller.ts
import { Type } from 'class-transformer';

class KgConfigDto {
  @IsInt()
  @Type(() => Number)
  primaryModelId: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  fallbackModelIds: number[];
}
```

## 问题 2：知识图谱模型配置只展示已启用模型

**根因**：`loadModels()` 从 `GET /api/admin/llm-models` 获取所有模型，未过滤 `isEnabled === true`。

**修复**：在 `KnowledgeGraphConfigPage.vue` 前端请求参数中添加 `isEnabled: true` 过滤，或在拿到数据后前端过滤 `m.isEnabled`。

## 问题 3：AI 公关功能依旧无法使用

**根因**：`PrReportsPage.vue` 的 `onMounted` 中 `await loadReports()` 完成后，若列表为空则调用 `loadMockReport()`。此逻辑已实现但可能存在时序问题——`loading` 初始值为 `false`，组件挂载时条件 `!loading && reports.length === 0` 短暂成立后又因 `loadReports()` 设置 `loading=true` 而隐藏，最终 `loadMockReport()` 填充数据。

**修复确认**：
1. 移除 `loadReports()` 中的 `loading` 状态切换（直接使用初始值 `false`）
2. 在 `onMounted` 中同步调用 `loadMockReport()` 填充示例数据
3. 保留 `loadReports()` 异步加载真实数据，完成后若列表为空则覆盖为 mock

---

确认后实施。
