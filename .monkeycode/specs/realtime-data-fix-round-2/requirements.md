# Requirements Document — 管理端实时数据整改

Feature: realtime-data-fix-round-2
Spec Version: 260719
Status: Draft
Owner: Admin Frontend Team
Updated: 2026-07-19

---

## 1. Introduction

承接 260718 之后用户反馈的 3 项"实时数据不真实"问题：

| # | 名称 | 性质 |
|---|------|------|
| REQ-11 | 竞品追踪无法实时显示真实信息 | 真实数据聚合 |
| REQ-12 | 品牌声誉无法实时显示真实信息 | 真实数据聚合 |
| REQ-13 | 值班面板无法连接，一直显示离线 | WebSocket 连接生命周期 |

每项按 EARS / INCOSE 规范表述，"支持商用"为合格线：可观测、可回滚、数据真实。

---

## 2. Glossary

| 术语 | 含义 |
|------|------|
| 真实数据 | 直接从 MySQL `opinion_events` / `monitor_tasks` / `alert_rules` / `competitor_groups` 等业务表聚合查询的结果 |
| 实时 | 数据延迟 ≤ 60 秒（值班面板） / 用户主动刷新（品牌/竞品） |
| Mock 数据 | 硬编码的 fake 数据（数组 / 随机数） |
| 兜底 | 数据查询失败时显示的友好提示，不展示假数据 |
| 空态 | 数据库无数据时的友好提示 |
| SSE | Server-Sent Events，长连接服务端单向推送 |
| Socket.IO | 双向 WebSocket 库，支持 namespace 与 room |
| JWT | JSON Web Token，用于接口鉴权 |
| 聚合查询 | 多表 JOIN + GROUP BY + 业务计算后的统计结果 |

---

## 3. Requirements

### REQ-11 竞品追踪真实数据

**User Story**: AS 管理员, I WANT 在「竞品追踪」页面看到竞品组下各竞品的真实声量/情感/平台分布数据, SO THAT 商用报告基于真实业务数据。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/competitor-tracking` 并选择已有竞品组, THE 前端 SHALL 调用 `GET /api/competitor/groups/:id/comparison`，后端基于 `opinion_events.title` / `opinion_events.content` LIKE 匹配 `competitor_groups.competitors` 中的 `keywords`，聚合返回 `competitors[]` 真实数据。
2. THE 后端 `CompetitorService.getComparison()` SHALL 移除所有 `getMockComparison()` 引用，返回数据 100% 来自 `opinion_events` 表聚合。
3. IF `competitor_groups` 表无数据, THE 前端 SHALL 显示「📊 暂无竞品组，点击「新建竞品组」开始分析」空态，**不展示任何假数据**。
4. IF 数据库中 `opinion_events` 24 小时内无匹配事件, THE 前端 SHALL 显示「暂无数据，可尝试扩大时间范围」兜底提示，并显示「最近 7 天 / 30 天」切换按钮。
5. THE 前端 SHALL 提供「刷新」按钮，点击后重新调用接口，时间戳显示「最近更新于 HH:mm:ss」。

**Correctness Properties**：

- CP-9：创建竞品组（含 2 个竞品名 "LV" / "GUCCI"）后等待 1 分钟或手动触发数据采集，访问 `/competitor-tracking` 显示竞品名 + 真实声量数字（≥ 0）。
- CP-10：所有声量数字与 MySQL `SELECT COUNT(*) FROM opinion_events WHERE title LIKE '%LV%'` 一致。

---

### REQ-12 品牌声誉真实数据

**User Story**: AS 管理员, I WANT 在「品牌声誉管理」页面输入品牌关键词点击「分析」后看到真实的声量/NPS/情感趋势, SO THAT 商业洞察基于真实舆情数据。

**Acceptance Criteria**:

1. WHEN 管理员在 `/brand-reputation` 输入品牌关键词数组并点击「分析」, THE 前端 SHALL 调用 `POST /api/brand-reputation`，后端基于 `opinion_events.title` / `content` LIKE 匹配关键词，聚合返回 `overview` / `timeSeries` / `competitorComparison` 真实数据。
2. THE 后端 `BrandReputationService.getReputation()` SHALL 100% 走真实聚合，移除 `getMockReputation()` 调用分支。
3. THE `overview` 字段 SHALL 包含：`brandVoice`（匹配事件数）/ `shareOfVoice`（品牌声量 / 全平台声量 × 100%）/ `npsScore`（正面占比 × 100 - 负面占比 × 100）/ `sentimentScore`（正面 - 负面）/ `trend`（rising / stable / declining）。
4. THE `timeSeries` SHALL 按天聚合，数组长度 = `days` 参数（7/30/90/365）。
5. IF 品牌关键词无匹配事件, THE 前端 SHALL 显示「该品牌暂无舆情数据，建议：① 检查关键词 ② 扩大时间范围 ③ 创建监控任务采集数据」三步引导。
6. THE 前端 SHALL 显示「数据更新时间」时间戳，便于用户判断数据新鲜度。

**Correctness Properties**：

- CP-11：输入关键词 "LV" + 7 天，分析结果 `brandVoice` 与 `SELECT COUNT(*) FROM opinion_events WHERE title LIKE '%LV%' AND matched_at > DATE_SUB(NOW(), INTERVAL 7 DAY)` 一致。
- CP-12：`shareOfVoice` 计算结果与公式 `brandVoice / totalEvents × 100` 一致，误差 ≤ 0.01。

---

### REQ-13 值班面板 WebSocket 连接修复

**User Story**: AS 管理员, I WANT 进入「值班面板」后立即看到「实时」连接状态，事件流持续推送, SO THAT 突发舆情第一时间感知。

**Acceptance Criteria**:

1. WHEN 管理员进入 `/duty`, THE 前端 SHALL 在 3 秒内与后端 `/duty` namespace 建立 Socket.IO 连接，连接成功显示「实时」绿色标签。
2. THE 前端 SHALL 在 `socket.on('connect')` 后立即调用 `GET /api/duty/overview` 获取首屏数据，**不等 WebSocket 推送**。
3. THE 前端 SHALL 通过 Socket.IO 加入 `duty-room` 房间，订阅 `overview` 事件，每 30 秒接收后端推送的最新 overview。
4. IF WebSocket 连接断开, THE 前端 SHALL 在 5 秒后自动重连，UI 显示「离线 · 5s 后自动重连」黄色标签；连续 3 次重连失败后显示「重连失败 · 点击重试」红色标签。
5. THE 后端 `DutyGateway.broadcastOverview()` SHALL 通过 `@Cron(EVERY_30_SECONDS)` 定时调用 `dutyService.getOverview()`，向 `duty-room` 房间所有 socket 发送 `overview` 事件。
6. IF 后端 DutyModule 未注册, THE 前端 SHALL 在 5 秒后检测到连接失败，显示「值班面板服务未启动」友好提示 + 跳转设置入口。

**Correctness Properties**：

- CP-13：连续保持 `/duty` 页面 5 分钟，readyState 始终为 CONNECTED，无「实时连接断开」warning。
- CP-14：手动 kill 后端进程，前端 5 秒内显示「离线」，后端重启后 5 秒内自动重连成功。

---

## 4. Out-of-Scope

1. **前端 SSE 替代方案**：暂不切换 SSE，保持 Socket.IO
2. **离线缓存**：值班面板离线时不展示历史数据，仅显示离线提示
3. **多租户隔离**：竞品/品牌数据按 user_id 隔离已实现，不再扩展
4. **实时推送告警级别**：当前定时推送 30 秒一期，不做告警级别即时推送

---

## 5. Compliance / Quality

- 错误码：复用既有 i18n 错误码体系 + 新增 `DATA_NOT_FOUND` / `WS_CONNECTION_FAILED`
- 数据：所有聚合查询必须 `LIMIT 10000` 防 OOM
- 性能：单次聚合查询 ≤ 500ms
- 安全：JWT 鉴权失败立即断开 WebSocket，不重试
- 日志：WebSocket 连接 / 断开 / 错误均记录到 `system_logs` 表

