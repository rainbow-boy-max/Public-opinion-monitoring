# Requirements Document — 管理端 LLM 模型管理升级

Feature: llm-admin-upgrade
Spec Version: 260718-2
Status: Draft
Owner: Admin Frontend Team
Updated: 2026-07-14

---

## 1. Introduction

承接用户对 `/llm-models` 页的 5 项商用升级要求：

| # | 名称 | 性质 |
|---|---|---|
| REQ-1 | API Key 未配置自动禁用 / 配置后自动启用 + 手动可控 | 业务规则 |
| REQ-2 | 批量多选启用/禁用 | 操作效率 |
| REQ-3 | 预置厂商补齐 MiniMax | 接入扩展 |
| REQ-4 | 模型手动排序 | UX 整理 |
| REQ-5 | 预置模型可编辑可删除 + 一键初始化 | 数据治理 |

每项按 EARS / INCOSE 规范；支持商用为目标。

---

## 2. Glossary

| 术语 | 含义 |
|---|---|
| 预置模型 | `is_preset=1` 的 LLM 模型，由 `LlmModelsService.onModuleInit` 启动时 seed |
| 关键状态 | `is_enabled`：启用 / 禁用 |
| API Key 兜底值 | `PLACEHOLDER_ENCRYPTED = '__PLACEHOLDER_NEED_USER_INPUT__'`，表示未配置 Key |
| 拖拽排序 | 用户通过 el-table 拖拽调整行顺序，后端写 `sort_order` |

---

## 3. Requirements

### REQ-1 API Key 缺失时自动禁用 / 手动可控

**User Story**: AS 管理员, I WANT 任何没有配置 API Key 的模型自动呈"禁用"状态、配置完 Key 后自动变"启用", SO THAT 不会出现"没填 Key 还被使用"的脏数据；同时我仍能手动强制启用或禁用。

**Acceptance Criteria**:

1. WHEN 管理员保存/更新 LLM 模型，THE 后端 SHALL 根据 `apiKey` 字段判定 isEnabled：
   - 传入了真实 Key（`apiKey !== '********'` 且非空）→ `isEnabled = 1`
   - 没有传 Key（`apiKey` 不在 body 中或为空字符串）→ `isEnabled = 0`
   - 但若 body 中 `isEnabled` 显式为 `false`（强制禁用）→ `isEnabled = 0`，覆盖自动推断
   - 若 body 中 `isEnabled` 显式为 `true`（强制启用）→ `isEnabled = 1`（**前提是 apiKey 已配置**；未配置时仍以 key 是否存在为准）
2. WHEN 列表加载, THE 后端 SHALL 在 list 输出中附带 `apiKeyConfigured: boolean`（已有）与 `isEnabled: boolean`（已有），并新增 `effectiveState: 'enabled' | 'disabled_pending_key'` 字段：
   - `enabled` 当 `isEnabled=1` 且 `apiKeyConfigured=true`
   - `disabled_pending_key` 当 `isEnabled=0` 且 `apiKeyConfigured=false`
   - `disabled` 当 `isEnabled=0` 且 `apiKeyConfigured=true`
   - `enabled_force` 当 `isEnabled=1` 且 `apiKeyConfigured=false`（用户手动启用但无 Key —— 不应发生）
3. WHEN 管理员手动点击 switch 切换, THE 前端 SHALL 走原 `PUT /:id` + `{ isEnabled }`，后端保留 `isEnabled` 显式值，但**自动禁用对无 Key 模型被强制启用的回写逻辑**：如果 `isEnabled=true` 但 `apiKeyConfigured=false`，后端 SHALL 拒绝并返回 `errorCode: 'LLM_KEY_REQUIRED'`。
4. THE 前端状态徽章 SHALL 根据 `effectiveState` 显示：🟢 enabled / 🟡 disabled_pending_key / ⚪ disabled / ⚠ enabled_force（异常态）。

**Correctness Properties**：
- CP-1：未填 Key 时 `PUT /admin/llm-models` 不传 `isEnabled` → 列表中 `isEnabled=0`
- CP-2：填 Key 后 `isEnabled=1` 自动生效
- CP-3：填 Key 后手动设 `isEnabled=false` → 后端接受

---

### REQ-2 批量多选启用 / 禁用

**User Story**: AS 管理员, I WANT 在 LLM 模型表勾选多个模型后一键启用 / 禁用, SO THAT 一次操作完成大批量配置变更。

**Acceptance Criteria**:

1. THE 前端 `el-table` SHALL 支持多选（`@selection-change` + 第一列 `type="selection"`）。
2. WHEN 至少 1 个模型被勾选, THE 表格顶部出现批量操作工具栏：显示"已选 N 项" + "批量启用" + "批量禁用" + "清空选择"。
3. WHEN 管理员点击"批量启用/禁用", THE 前端 SHALL `PUT /admin/llm-models/batch` body：
   ```json
   { "ids": [1,2,3], "isEnabled": true, "force": false }
   ```
4. THE 后端 SHALL 接受批量请求；对无 Key 但被启用的情况按 REQ-1 规则拒绝（`errorCode: LLM_KEY_REQUIRED`）并把成功的 ID 列表返回。
5. THE 列表 SHALL 在批量操作完成后自动 reload，提示"成功 N 项，失败 M 项"。

**Correctness Properties**：
- CP-4：批量启用 50 个无 Key 模型 → 后端 100% 拒绝并返回 0 成功
- CP-5：批量启用 50 个有 Key 模型 → 后端 100% 成功

---

### REQ-3 预置厂商补齐 MiniMax

**User Story**: AS 管理员, I WANT LLM 预置列表里有 MiniMax（MiniMax）公司的预置模型, SO THAT 我能快速接入国产前沿大模型。

**Acceptance Criteria**：

1. THE `LlmModelsService.PRESET_PROVIDERS` 增补 MiniMax provider：
   - `provider: 'minimax'`
   - `displayName: 'MiniMax'`
   - `baseUrl: 'https://api.minimax.io/v1'`（OpenAI 兼容端点）
   - `models`：
     - `MiniMax-M3`（1M context，多模态）
     - `MiniMax-M2.7` 与 `MiniMax-M2.7-highspeed`
     - `MiniMax-M2.5` 与 `MiniMax-M2.5-highspeed`
     - `MiniMax-M2.1` 与 `MiniMax-M2.1-highspeed`
     - `MiniMax-M2`
2. WHEN 启动服务时 seed 上述模型（已存在则保留），THEN preset capabilities 按模型名推断：
   - 全部模型 `vision: false`（OpenAI 兼容端点不支持 vision，至少在 EP 2.x 阶段）
   - `MiniMax-M3` `reasoning: true`（支持 thinking 块）
   - 其余 `reasoning: false`
   - `webSearch: false`
3. THE MiniMax 预置的 `apiKey` 为 `PLACEHOLDER_ENCRYPTED`，`is_enabled=0`，与其它预置一致。
4. THE 现有 dashboard.service.overview / recent-activities 不受影响。

**Correctness Properties**：
- CP-6：seed 完成后 `GET /admin/llm-models/presets` 返回的 providers 包含 `minimax`
- CP-7：`inferCapabilities('MiniMax-M3').reasoning === true`

---

### REQ-4 模型手动排序

**User Story**: AS 管理员, I WANT 在 LLM 模型表里通过拖拽或序号按钮调整模型展示顺序, SO THAT 我能按业务优先级排列。

**Acceptance Criteria**：

1. THE `llm_models` 表新增 `sort_order INT NOT NULL DEFAULT 0` 字段（migration）。
2. THE `GET /admin/llm-models` 返回时按 `(sort_order ASC, id ASC)` 排序；preset list 不变顺序（默认 0）。
3. THE 前端 `el-table` 行可拖拽（`<el-table :row-class-name>` + `Sortable.js` 或 vue-draggable-next），拖动一行到新位置释放后：
   - THE 前端 SHALL `PUT /admin/llm-models/:id` body `{ sortOrder: <new_index> }` 持久化；
   - THE 后端 SHALL 接受 sortOrder 整数；同 batch transaction 把该 index 至原 index 之间的所有行 `sort_order` 重新编号（dense reorder），避免序号空洞。
4. THE 也可使用每行末尾的"上移/下移"按钮，行为等价。

**Correctness Properties**：
- CP-8：拖动后 GET 列表新顺序持久化
- CP-9：批量调整无 sortOrder 冲突

---

### REQ-5 预置模型可编辑可删除 + 一键初始化

**User Story**: AS 管理员, I WANT 对预置模型做修改或删除（覆盖原 seed），并在任意时候一键恢复出厂预置, SO THAT 出问题时能复位。

**Acceptance Criteria**：

1. THE 预置模型 `is_preset=1` 不再"前端不可编辑"：
   - 前端表格"编辑/删除"按钮对 `is_preset=1` 启用
   - 弹"这是系统预置模型，编辑/删除会覆盖出厂设置"提示，用户可选择"仅本次覆盖"或"重新初始化后该修改将丢失"
2. THE `DELETE /admin/llm-models/:id` 对预置模型允许删除（移除该条记录），下次启动 seed 不会复活（因为是 ON CONFLICT DO NOTHING）。
3. THE `POST /admin/llm-models/init-presets` 接口：
   - 清空 `llm_models` 表（仅 `is_preset=1` 的记录），然后重新 seed
   - **不**删除 `is_preset=0` 的自定义模型
   - 返回 `{ added: N, removed: M, kept_custom: K }`
4. THE 前端"管理"工具栏加"🔁 一键初始化预置"按钮，确认对话框后调上面接口，结果 ElMessage 提示。
5. THE"编辑"对话框对预置模型显示一个"ⓘ 这是预置"角标，编辑保存后写库，但用户可继续编辑直到初始化时一并覆盖。

**Correctness Properties**：
- CP-10：删除一个预置模型后 GET 列表少一条；重启 nest 不复活（除非调 init-presets）
- CP-11：init-presets 后所有预置模型 `is_preset=1` 重新存在

---

## 4. Out-of-Scope

1. 预置模型 seed 时的 onModuleInit 失败回退（错误不阻塞启动）
2. 拖拽排序的批量持久化优化（dense reorder 性能 < 1s 完成）
3. MiniMax 视频 / 图像 API（仅文本模型）
4. 多语言 Provider 描述翻译（中文为主）
5. 与 DASHSCOPE / QWEN-VL 等子模型的能力同步

---

## 5. Compliance / Quality

- 风格沿用前几期 EARS / INCOSE 规范
- 错误码：复用 + 新增 `LLM_KEY_REQUIRED`（i18n）
- 密钥：所有 API Key 仍 AES-256-CBC 加密落库
- 数据迁移：所有 schema 变更用 TypeORM migration（1700000070000 + 1700000080000）
- 性能：批量操作 P95 ≤ 500 ms（100 条内）
- 安全：批量操作需要 admin 角色；rate-limit 1000/min