# Phase 12 性能优化 — 实施报告

## 状态：已完成（应用层可落地范围）

### 规划文档参考
`.monkeycode/upgrade-plan.md` 第 406-453 行

### 完成项

#### 12.1 查询性能 — 索引补齐
- 新建迁移 `1700000220000-Phase12PerfIndexes.ts`，添加 5 个复合索引到 `opinion_events`：
  - `idx_events_matched_at` — `matchedAt` 单字段
  - `idx_events_sentiment_time` — `sentiment, matchedAt`
  - `idx_events_platform_time` — `platform, matchedAt`
  - `idx_events_task_publish` — `taskId, publishTime`
  - `idx_events_status_time` — `status, matchedAt`
- `opinion-event.entity.ts` 同步添加 5 个 `@Index` 装饰器

#### 12.2 采集队列 — 并发与去重
- Bull 队列 `attempts: 2` + 指数退避（`backoff: { type: 'exponential', delay: 5000 }`）
- 平台拉取从串行改为 `Promise.all` 并发（`collector.service.ts`）
- 去重从 `exists+set` 改为 `setIfAbsent`（原子 NX 操作），消除竞态窗口
- 采集保存后自动 `scanDelete` 失效 `dashboard:widget:${userId}:*` 缓存
- 4 个单测覆盖原子去重、重复跳过、关键词过滤、缓存失效

#### 12.3 分页与缓存 — 统一缓存封装 + 游标分页
- `QueryCacheService`：全局注入的 Redis 查询缓存，支持 `wrap<T>(key, ttl, loader)` 和 `invalidate(key)`
- `dashboard.service.ts` 的 `getWidgetData` 用 `queryCache.wrap` 包装，30s TTL
- `cursorPaginate` 游标分页工具（`common/utils/cursor-pagination.ts`），支持 `forward/backward` 方向
- `monitor-tasks.service.ts` 的 `listEvents` 扩展为支持 `useCursor` 参数，游标分页加 15s 缓存
- `monitor-tasks.controller.ts` 暴露 `cursor` 和 `useCursor` 查询参数

#### 12.4 监控埋点 — 性能指标 + 健康探针
- `MetricsService`：请求计数、错误计数、内存使用量、Bull 队列状态
- `MetricsInterceptor`：全局请求拦截器，记录慢查询（>1s 告警）和错误计数
- `OpsController`：`GET /api/ops/healthz`（Redis/Bull/DB 三路健康检查）和 `GET /api/ops/metrics`
- `RedisService` 新增 `setIfAbsent`（原子 NX）和 `scanDelete`（通配符批量删除）

### 边界说明（单机环境未落地）

以下基础设施依赖重型中间件，单机环境无法完整搭建，但已通过 MariaDB 原生能力 + 应用层代码实现替代方案：

| 规划项 | 替代方案 | 状态 |
|--------|----------|------|
| Elasticsearch 全文检索 | MariaDB FULLTEXT 索引 + `MATCH...AGAINST` 布尔搜索 | 已实现 |
| ClickHouse 冷热数据归档 | 归档服务 + `archivedAt` 标记 + 定时 @Cron 每日清理 | 已实现 |
| MySQL 分库分表 | `opinion_events` 按月 RANGE 分区 + 读写分离数据源配置（`DB_REPLICA_HOST` 环境变量） | 已实现 |
| Prometheus + Grafana 可视化 | Prometheus 文本格式 `/api/ops/prometheus` 端点 + `# HELP`/`# TYPE` 标签 | 已实现 |

### 测试结果
- 5 个测试套件、26 个测试用例全部通过
- 前端 `vue-tsc --noEmit` 类型检查通过
- 后端 `tsc --noEmit` 类型检查通过

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/src/common/cache/query-cache.service.ts` | 统一 Redis 查询缓存封装 |
| `backend/src/common/interceptors/metrics.interceptor.ts` | 请求计数 + 慢查询拦截器 |
| `backend/src/common/utils/cursor-pagination.ts` | 游标分页工具函数 |
| `backend/src/common/utils/cursor-pagination.spec.ts` | 游标分页 3 个单测 |
| `backend/src/modules/collector/metrics.service.ts` | 性能指标 + 健康检查服务 |
| `backend/src/modules/collector/ops.controller.ts` | `/api/ops/healthz` 和 `/api/ops/metrics` |
| `backend/src/modules/collector/collector.service.spec.ts` | 采集队列优化 4 个单测 |
| `backend/src/database/migrations/1700000220000-Phase12PerfIndexes.ts` | 5 个复合索引迁移 |
| `backend/src/database/migrations/1700000230000-Phase12FulltextPartitionArchive.ts` | FULLTEXT 索引 + 分区表 + 归档表迁移 |
| `backend/src/modules/fulltext-search/fulltext-search.module.ts` | 全文搜索模块 |
| `backend/src/modules/fulltext-search/fulltext-search.service.ts` | 多实体 MATCH AGAINST 搜索 |
| `backend/src/modules/fulltext-search/fulltext-search.controller.ts` | `GET /api/search?q=...` 端点 |
| `backend/src/modules/archive/archive.module.ts` | 数据归档模块 |
| `backend/src/modules/archive/archive.service.ts` | 定时归档 + 配置管理 |
| `backend/src/modules/archive/archive.controller.ts` | `GET/POST /api/archive/*` 端点 |