# 实施计划：llm-admin-upgrade（260718-2）

> 基线：`.monkeycode/specs/260718-llm-admin-upgrade/requirements.md` + `design.md`
> 优先级：REQ-1（自动启用）> REQ-5（一键初始化）> REQ-3（MiniMax）> REQ-2（批量）> REQ-4（排序）

---

## 1. REQ-1 API Key 自动推断 is_enabled

- [ ] 1. 后端：`LlmModelsService.inferIsEnabledByKey(dto, current)`
  - 当 dto 包含 `apiKey` 非占位符 → `enabled = true`
  - 当 dto 包含 `isEnabled: false` → 强制 false
  - 当 dto 包含 `isEnabled: true` 且 apiKey 未配置 → throw `LLM_KEY_REQUIRED`
  - 关联：REQ-1.1

- [ ] 2. 后端：`LlmModelsService.serialize` 增加 `effectiveState`
  - 计算 enabled / disabled / disabled_pending_key / enabled_force
  - 关联：REQ-1.2

- [ ] 3. 后端：`llm-models.controller.save / update` 调 `inferIsEnabledByKey`
  - 关联：REQ-1.1

- [ ] 4. 后端：业务异常 `LLM_KEY_REQUIRED`（i18n）
  - 关联：REQ-1.1

- [ ] 5. 前端：`ModelsTable.vue` 状态徽章按 `effectiveState` 显示
  - 关联：REQ-1.4

- [ ] 6. 检查点：CP-1/CP-2/CP-3 验证（curl）

## 7. REQ-5 预置模型治理

- [ ] 7. 后端：`POST /admin/llm-models/init-presets`
  - 删 `is_preset=1` 记录，重新 seed
  - 不动 `is_preset=0` 的自定义模型
  - 返回 `{ removed, added, keptCustom }`
  - 关联：REQ-5.3

- [ ] 8. 前端：`LlmModelsManagementPage.vue` 顶部"🔁 一键初始化预置"按钮 + 二次确认
  - 关联：REQ-5.4

- [ ] 9. 前端：编辑对话框对预置模型显示角标 + 确认
  - 关联：REQ-5.5

- [ ] 10. 检查点：CP-10/CP-11

## 11. REQ-3 MiniMax 预置

- [ ] 11. 后端：`LlmModelsService.PRESET_PROVIDERS` 增补 MiniMax
  - `provider: 'minimax'`
  - `baseUrl: 'https://api.minimax.io/v1'`
  - 8 个模型（M3, M2.7, M2.7-highspeed, M2.5, M2.5-highspeed, M2.1, M2.1-highspeed, M2）
  - 关联：REQ-3.1

- [ ] 12. 后端：`inferCapabilities` 加 MiniMax-M3 → reasoning=true
  - 关联：REQ-3.2 / CP-7

- [ ] 13. 检查点：seed 后 presets 含 `minimax`

## 14. REQ-2 批量多选

- [ ] 14. 后端：`PUT /admin/llm-models/batch` controller
  - 接受 `{ ids, isEnabled, force }`
  - 调 service 批量更新；force=false 时跳过无 Key 模型
  - 返回 `{ ok, successIds, failedIds }`
  - 关联：REQ-2.3 / REQ-2.4

- [ ] 15. 前端：el-table `type="selection"` + `@selection-change`
  - 关联：REQ-2.1

- [ ] 16. 前端：批量工具栏（已选 N 项 / 启用 / 禁用 / 清空）
  - 关联：REQ-2.2

- [ ] 17. 前端：操作后 ElMessage 提示
  - 关联：REQ-2.5

- [ ] 18. 检查点：CP-4/CP-5

## 19. REQ-4 模型手动排序

- [ ] 19. migration `1700000070000-AddLlmModelSortOrder.ts`
  - 关联：REQ-4.1

- [ ] 20. 后端：`LlmModelsService.reorderSortOrder(agentId, fromIndex, toIndex)`
  - 同一 provider / 全部范围内按 `sort_order` 升序 dense reorder
  - 关联：REQ-4.3

- [ ] 21. 后端：`PUT /admin/llm-models/:id` 接受 `sortOrder`
  - 关联：REQ-4.3

- [ ] 22. 前端：`el-table` 行拖拽（使用 Sortable.js 或 vue-draggable-next）
  - 关联：REQ-4.3

- [ ] 23. 前端：每行末尾"上移/下移"按钮（兜底）
  - 关联：REQ-4.4

- [ ] 24. 检查点：CP-8/CP-9

## 25. 最终

- [ ] 25. 跑 migration (1700000070000) 验证 schema
- [ ] 26. nest start --watch 自动 reload
- [ ] 27. production build `pnpm --filter frontend-admin build`
- [ ] 28. 全部 11 条 CP 回归
- [ ] 29. git commit & 推 spec
- [ ]* 29.1 单元测试（inferIsEnabledByKey / batch / reorder）
- [ ]* 29.2 e2e 烟测