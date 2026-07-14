# 实施计划 v2：llm-admin-upgrade-v2（260718-3）

> 基线：`.monkeycode/specs/260718-llm-admin-upgrade-v2/`
> 范围：v1 的 5 项 + v2 新增 4 项

---

## 1. v1 的 5 项（已在另一文档中规划，本期合并实施）

- [ ] 1. 后端：`LlmModelsService.inferIsEnabledByKey(dto, current)` + 状态枚举
- [ ] 2. 后端：`POST /init-presets` + 编辑/删除预置放开
- [ ] 3. 后端：MiniMax preset 加 provider
- [ ] 4. 后端：`PUT /batch` + 拖拽排序
- [ ] 5. 前端：多选 + 批量工具栏 + 拖拽 + 一键初始化按钮
- [ ] 6. migration `1700000070000-AddLlmModelSortOrder.ts`
- [ ] 7. 检查点：CP-1 ~ CP-11 验证

## 8. v2 REQ-6 apiStyle 字段

- [ ] 8. migration `1700000080000-AddLlmModelApiStyle.ts`
- [ ] 9. 后端：`LlmModelsService.applyDto` 接受 `apiStyle`
- [ ] 10. 后端：`inferCapabilities(model, provider, apiStyle)` 扩展 M3
- [ ] 11. 后端：业务异常 `LLM_INVALID_API_STYLE`
- [ ] 12. 前端：`EditModelDialog` 加 apiStyle radio
- [ ] 13. 检查点：CP-12/CP-13

## 14. v2 REQ-7 Anthropic 兼容预置

- [ ] 14. 后端：加 `deepseek_anthropic` + `minimax_anthropic` preset
- [ ] 15. 检查点：CP-14

## 16. v2 REQ-8 M3 capabilities 按 apiStyle 推断

- [ ] 16. 后端：`inferCapabilities` 完整实现
- [ ] 17. 检查点：CP-15

## 18. v2 REQ-9 批量启用 UI 反馈

- [ ] 18. 后端：batch 响应补 `skipped` 字段
- [ ] 19. 前端：批量工具栏三态 ElMessage
- [ ] 20. 检查点：CP-16

## 21. v2 REQ-6 LlmRouter Anthropic 路径（最大块）

- [ ] 21. 后端：`LlmRouterService` 拆分 `callOpenAIChat` 与 `callAnthropicMessages`
- [ ] 22. 后端：Anthropic 系统提示词移到顶层 `system` 字段
- [ ] 23. 后端：Anthropic 鉴权头 `x-api-key` + `anthropic-version: 2023-06-01`
- [ ] 24. 后端：流式响应解析（`message_start` / `content_block_delta` / `message_delta` / `message_stop`）
- [ ] 25. 后端：非流式响应从 `content[0].text` 提取
- [ ] 26. 集成测试：mock fetch 验证 Anthropic 路径调用

## 27. 最终

- [ ] 27. 跑 2 个 migration
- [ ] 28. nest start --watch 自动 reload
- [ ] 29. production build `pnpm --filter frontend-admin build`
- [ ] 30. 全部 16 条 CP 回归
- [ ] 31. git commit & 推 spec
- [ ]* 31.1 单元测试（apiStyle 推断、Anthropic 响应解析）
- [ ]* 31.2 e2e 烟测