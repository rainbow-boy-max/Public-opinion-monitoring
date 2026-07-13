# 全网舆情监测系统 - 实施任务列表

## 实施概述

基于 `requirements.md` 和 `design.md` 生成本任务列表。系统采用前后端分离架构，分 7 个 Epic 推进：项目脚手架与认证 → 管理端配置 → 用户管理 → 监控任务与数据采集 → 实时大屏 → Webhook 与短信通知 → 部署加固。每个任务以代码可执行粒度拆分，测试任务作为可选子任务（标 `*`），由用户决定是否纳入本次实施。

## 任务列表

- [ ] 1. 项目脚手架与基础设施搭建
  - [ ] 1.1 初始化 monorepo 项目结构（`frontend-admin/`、`frontend-user/`、`backend/`、`docker/`、`docs/`），各子项目独立 `package.json`，根目录用 pnpm workspace 管理依赖
  - [ ] 1.2 初始化后端 NestJS 项目（`backend/`），配置 TypeScript strict 模式，安装核心依赖：`@nestjs/jwt`、`@nestjs/passport`、`@nestjs/websockets`、`@nestjs/schedule`、`bull`、`socket.io`、`typeorm`、`mysql2`、`ioredis`、`class-validator`、`class-transformer`、`@alicloud/dysmsapi20170525`（阿里云短信 SDK）
  - [ ] 1.3 初始化两个 Vue 3 前端项目（`frontend-admin/` 和 `frontend-user/`），使用 Vite + TypeScript + Pinia + Vue Router，配置 `allowedHosts: ['.monkeycode-ai.online']` 和反向代理 `/api` → `http://localhost:3000`，参考 `vite-allowedhosts-config.md` 与 `frontend-reverse-proxy.md` 规则
  - [ ] 1.4 配置 Docker Compose（`docker/docker-compose.yml`），定义 `mysql`、`redis`、`backend`、`nginx` 四个服务，MySQL 挂载持久卷、Redis 配置 AOF 持久化
  - [ ] 1.5 后端创建配置模块 `ConfigModule`，从环境变量读取：`DB_*`、`REDIS_*`、`JWT_SECRET`、`AES_ENCRYPTION_KEY`、`PORT`，所有阿里云凭据不读环境变量直接进业务代码（设计文档"安全设计"章节约束）
  - [ ] 1.6 编写 AES-256-CBC 加解密工具 `CryptoUtil`（`encrypt(plain)` / `decrypt(cipher)`），加密密钥来自环境变量 `AES_ENCRYPTION_KEY`
  - [ ] 1.7 编写 MySQL TypeORM 连接配置（`backend/src/database/database.module.ts`），连接参数从 ConfigModule 读取，开发环境开启 `synchronize: false`，使用迁移方式管理 schema
  - [ ] 1.8 编写 Redis 连接模块（`backend/src/redis/redis.module.ts`），基于 `ioredis`，提供 `RedisService` 封装常用操作和 Pub/Sub 接口
  - [ ] 1.9 配置 ESLint + Prettier + TypeScript strict 模式，前后端共用根目录配置，pre-commit 钩子（lint-staged + husky）
  - [ ]* 1.10 为 AES 加解密工具编写单元测试，验证加解密一致性和密文长度
  - [ ]* 1.11 为 Redis 模块编写集成测试，验证基本读写和 Pub/Sub 收发

- [ ] 2. 检查点 - 基础设施就绪
  - 确保所有项目脚手架可启动，Docker Compose 可拉起，MySQL 和 Redis 连接正常

- [ ] 3. 数据库 Schema 与实体定义
  - [ ] 3.1 创建 TypeORM 实体：`UserEntity`（对应 `users` 表），字段含 `id`、`username`、`passwordHash`、`phone`、`realName`、`idCardHash`、`authStatus`（enum: `unverified`/`verified`/`banned`）、`role`（enum: `admin`/`user`）、`firstLogin`、`loginAttempts`、`lockedUntil`、`lastLoginAt`、`createdAt`、`updatedAt`（对应 requirements.md 模块1）
  - [ ] 3.2 创建 `AliyunConfigEntity`（对应 `aliyun_configs` 表），字段含 `id`、`configType`（`sms`/`real_name_verify`）、`accessKey`（加密存储）、`secretKey`（加密存储）、`signName`、`templateCode`、`productCode`（对应 requirements.md 模块2）
  - [ ] 3.3 创建 `MonitorTaskEntity`（对应 `monitor_tasks` 表），字段含 `id`、`userId`、`name`、`keywords`（JSON 数组）、`excludeKeywords`、`platforms`（JSON 数组）、`matchMode`、`sentimentFilter`、`minReadThreshold`、`minLikeThreshold`、`frequency`、`status`、`lastRunAt`、`createdAt`、`updatedAt`（对应 requirements.md 模块4）
  - [ ] 3.4 创建 `OpinionEventEntity`（对应 `opinion_events` 表），字段按设计文档 ER 图定义，添加联合索引 `idx_task_time(task_id, matched_at)` 和单列索引 `idx_publish_time`（对应 requirements.md 模块4验收4）
  - [ ] 3.5 创建 `WebhookEntity`（对应 `webhooks` 表），字段含 `id`、`userId`、`name`、`url`、`format`、`secretKey`、`pushOnMatch`、`pushPeriodic`、`periodicFreq`、`periodicTime`、`lastPushAt`、`status`、`createdAt`、`updatedAt`（对应 requirements.md 模块5）
  - [ ] 3.6 创建 `WebhookTaskBindingEntity`（对应 `webhook_task_bindings` 表），加唯一约束 `(webhook_id, task_id)`
  - [ ] 3.7 创建 `WebhookPushLogEntity`、`SmsLogEntity`、`SystemLogEntity`
  - [ ] 3.8 编写 TypeORM 迁移文件 `InitSchema` 初始化所有表结构，禁止使用 `synchronize: true`（对应设计文档"数据一致性"约束）
  - [ ] 3.9 编写数据库种子脚本 `seed.ts`，插入超级管理员账号 `admin`（密码 bcrypt 加密 `123456`，cost=12）、`firstLogin=1`、`role=admin`（对应 requirements.md 模块1验收2）
  - [ ]* 3.10 为各实体的字段约束编写单元测试（验证 enum 取值、JSON 字段格式、必填字段非空）

- [ ] 4. 检查点 - Schema 就绪
  - 确保迁移可执行成功，seed 数据写入正常，admin 账号密码哈希值正确

- [ ] 5. 认证模块实现（requirements.md 模块1 + 模块7）
  - [ ] 5.1 实现 `AuthService`：`login(username, password)` 校验密码（bcrypt compare）、检查账号锁定状态（`lockedUntil` > 当前时间）、处理失败计数（5 次失败后锁定 15 分钟）、签发 JWT Token（含 `jti`、`userId`、`role`、`exp`，有效期 7 天）（对应模块1验收1、验收6）
  - [ ] 5.2 实现 JWT 中间件 `JwtAuthGuard`：从 `Authorization` 头解析 Token、校验签名和过期、检查 Redis 黑名单 `blacklist:jti:{jti}`、注入 `req.user`
  - [ ] 5.3 实现 `AdminController.login`：若用户 `firstLogin === 1`，返回特殊响应码 `PASSWORD_CHANGE_REQUIRED`，前端跳转修改密码页（对应模块1验收2）
  - [ ] 5.4 实现 `POST /api/auth/change-password`：校验旧密码、bcrypt 哈希新密码、更新 `passwordHash` 和 `firstLogin=0`（对应模块1验收2）
  - [ ] 5.5 实现 `POST /api/auth/send-sms-code`：参数 `phone` + `scene`（`login`/`register`/`reset`），从 Redis 读取发送频率计数（`rate:sms:{phone}`，1 小时内最多 5 条），调用阿里云短信服务发送 6 位验证码，写入 Redis `sms:code:{phone}:{scene}` TTL 5 分钟（对应模块1验收3、验收4，模块9验收1）
  - [ ] 5.6 实现 `POST /api/auth/register`：校验短信验证码、bcrypt 哈希密码、创建用户 `authStatus=unverified`、`role=user`、`firstLogin=0`（对应模块1验收3）
  - [ ] 5.7 实现 `POST /api/auth/reset-password`：校验短信验证码、更新密码哈希、清除所有该用户的 Token 黑名单（对应模块1验收7）
  - [ ] 5.8 实现 `POST /api/auth/refresh-token`：用旧 Token 换新 Token，旧 Token 加入黑名单
  - [ ] 5.9 实现 `POST /api/verify/real-name`：从 `AliyunConfigEntity` 读取 `real_name_verify` 配置（解密 AccessKey/SecretKey）、调用阿里云手机号三要素详细版 API、通过则更新 `authStatus=verified`、`realName`、`idCardHash`（SHA-256），失败则返回哪个要素不匹配；24 小时内 3 次失败后锁定 7 天（对应模块7验收1-5）
  - [ ] 5.10 实现 `GET /api/verify/status` 返回当前用户认证状态
  - [ ] 5.11 实现登出接口 `POST /api/auth/logout`，将当前 Token jti 加入 Redis 黑名单
  - [ ] 5.12 实现全局异常过滤器 `AllExceptionsFilter`，统一错误响应格式 `{ code, message, data: null }`，区分 401/403/422/500 等响应
  - [ ] 5.13 前端用户端实现登录页、注册页（含短信验证码倒计时 60s 组件）、忘记密码页、三要素认证页，使用 Pinia 管理 token，axios 拦截器处理 401 自动跳转登录、403 显示封禁提示
  - [ ] 5.14 前端管理端实现登录页，处理 `PASSWORD_CHANGE_REQUIRED` 跳转强制修改密码页
  - [ ]* 5.15 为 `AuthService` 编写单元测试：5 次失败锁定、密码校验、JWT 签发、Token 黑名单逻辑
  - [ ]* 5.16 为三要素认证编写集成测试，使用 nock mock 阿里云 API 返回 200/4xx/5xx 三种场景
  - [ ]* 5.17 为前端 axios 拦截器编写单元测试，验证 401/403 处理流程

- [ ] 6. 检查点 - 认证系统可用
  - 确保登录、注册、短信验证、三要素认证、强制改密、Token 黑名单全部端到端跑通

- [ ] 7. 阿里云配置与短信服务（requirements.md 模块2 + 模块9）
  - [ ] 7.1 实现 `AliyunConfigService`：`getSmsConfig()` 返回解密后的阿里云短信配置；`saveSmsConfig(dto)` 加密存储；`getVerifyConfig()` 返回三要素配置；`saveVerifyConfig(dto)` 加密存储（对应模块2验收1）
  - [ ] 7.2 实现 `POST /api/admin/config/aliyun-sms` 和 `PUT /api/admin/config/aliyun-sms`，仅 `role=admin` 可访问，使用 `@Roles('admin')` 装饰器 + `RolesGuard`
  - [ ] 7.3 实现 `POST /api/admin/config/aliyun-verify` 和 `PUT /api/admin/config/aliyun-verify`
  - [ ] 7.4 实现 `GET /api/admin/config/test-sms`：发送测试短信到指定手机号验证配置生效（对应模块2验收2）
  - [ ] 7.5 实现 `SmsService.sendSms(phone, templateCode, params)` 封装阿里云 dysmsapi SDK，每次调用写入 `sms_logs` 表（对应模块9验收1-3）
  - [ ] 7.6 实现短信日发送量限制：每次发送前查询当天 `sms_logs` 计数，超管理端配置上限则拒绝发送并告警管理员（对应模块9验收5）
  - [ ] 7.7 实现配置热更新：保存配置后清除 Redis 缓存 `cache:aliyun-config:*`，下次读取从数据库加载（对应模块2验收5）
  - [ ] 7.8 监听阿里云 API 4xx 响应，记录 `system_logs` 错误日志，通过管理后台消息中心接口 `GET /api/admin/messages` 暴露给管理员（对应模块2验收4）
  - [ ] 7.9 前端管理端实现阿里云配置页面：短信配置表单（AccessKey/SecretKey/签名/模板）+ 三要素配置表单 + 测试发送按钮
  - [ ]* 7.10 为 `AliyunConfigService` 加解密读写编写单元测试
  - [ ]* 7.11 为 `SmsService` 编写集成测试，mock 阿里云 SDK 验证日志写入和频率限制逻辑

- [ ] 8. 检查点 - 短信与配置可用
  - 确保管理员可配置阿里云，测试短信可发出，配置热更新生效

- [ ] 9. 用户管理模块（requirements.md 模块3）
  - [ ] 9.1 实现 `GET /api/admin/users`：分页（每页 20 条）+ 筛选（用户名/手机号/注册时间段）+ 排序，返回字段含 `注册时间`、`认证状态`、`最后登录时间`、`账号状态`（对应模块3验收1、验收2）
  - [ ] 9.2 实现 `PUT /api/admin/users/:id/ban`：更新 `authStatus=banned`，将该用户所有未过期 Token jti 加入 Redis 黑名单，调用 `SmsService.sendSms` 通知用户（对应模块3验收3、验收5）
  - [ ] 9.3 实现 `PUT /api/admin/users/:id/unban`：根据用户是否完成三要素认证恢复 `authStatus=verified` 或 `unverified`，调用 `SmsService.sendSms` 通知用户（对应模块3验收4、验收5）
  - [ ] 9.4 封禁/解封操作写入 `system_logs`，含操作人 ID、目标用户 ID、操作时间、IP
  - [ ] 9.5 前端管理端实现用户管理页：分页表格 + 搜索栏 + 封禁/解封按钮 + 操作确认弹窗
  - [ ]* 9.6 为封禁/解封接口编写集成测试，验证 Token 黑名单写入和短信通知调用

- [ ] 10. 检查点 - 用户管理可用
  - 确保管理员可列出用户、搜索、封禁/解封，封禁后用户 Token 立即失效

- [ ] 11. 监控任务 CRUD（requirements.md 模块4）
  - [ ] 11.1 实现 `MonitorTaskService`：CRUD 操作均强制加 `userId` 条件 `WHERE user_id = :userId AND id = :id`，禁止跨用户读写（对应设计文档"数据一致性"约束1、模块10验收1）
  - [ ] 11.2 实现 `POST /api/monitor-tasks`：参数校验（关键词数组非空、平台数组至少 1 个、频率枚举值合法）、插入 `monitor_tasks`、立即创建 Bull Job 执行首次采集（对应模块4验收1、验收2）
  - [ ] 11.3 实现 `GET /api/monitor-tasks`：按 `lastRunAt` 倒序 + 命中数倒序，命中数通过子查询 `SELECT COUNT(*) FROM opinion_events WHERE task_id = ...` 计算（对应模块4验收3）
  - [ ] 11.4 实现 `GET /api/monitor-tasks/:id` 返回任务详情
  - [ ] 11.5 实现 `PUT /api/monitor-tasks/:id`：更新任务配置，重复 11.2 的 Bull Job 重新调度（先删除旧 Job 再创建新 Job）（对应模块4验收7）
  - [ ] 11.6 实现 `DELETE /api/monitor-tasks/:id`：删除任务前先清理 Bull 队列中所有相关 future Jobs，再删除数据库记录（对应设计文档"幂等性"约束3、模块4验收7）
  - [ ] 11.7 实现 `PUT /api/monitor-tasks/:id/toggle`：切换 `status` 在 `enabled`/`paused` 之间，paused 状态暂停 Bull Job 调度（对应模块4验收5）
  - [ ] 11.8 实现 `GET /api/monitor-tasks/:id/events`：分页返回该任务最近的舆情事件，每条包含 `platform`、`title`、`summary`、`author`、`publishTime`、`readCount`、`likeCount`、`commentCount`（对应模块4验收4）
  - [ ] 11.9 前端用户端实现监控任务管理页：任务列表卡片 + 创建表单（关键词输入组件 + 平台多选 + 频率选择）+ 任务详情页（舆情事件列表 + 平台/情感筛选器）
  - [ ]* 11.10 为 `MonitorTaskService` 编写单元测试，验证用户隔离的 SQL 条件拼接
  - [ ]* 11.11 为监控任务 CRUD 编写 E2E 测试，覆盖创建、更新、删除、列表筛选

- [ ] 12. 检查点 - 监控任务可用
  - 确保监控任务 CRUD 全流程可用，用户隔离严格生效

- [ ] 13. 数据采集适配器框架与各平台适配器（requirements.md 模块8 + 设计文档组件3）
  - [ ] 13.1 定义 `PlatformAdapter` 接口：`platform`、`displayName`、`fetchByKeywords(keywords, options)`、`healthCheck()`，定义 `RawOpinionEvent` 和标准化后的 `OpinionEvent` 接口（对应设计文档"数据采集适配器接口"）
  - [ ] 13.2 实现 `AdapterRegistry` 适配器注册中心：启动时扫描所有 `@PlatformAdapter('weixin')` 等装饰的类并注册到 Map，提供 `getAdapter(platform)` 方法
  - [ ] 13.3 实现 `OpinionNormalizer` 标准化模块：将各平台原始数据按字段映射规则转换为统一 `OpinionEvent` 格式，必填字段缺失时记录 `system_logs` 并跳过该条
  - [ ] 13.4 实现微博适配器 `WeiboAdapter`：对接微博开放 API 或聚合 API（具体端点由管理端配置，从 `aliyun_configs` 之外的 `data_source_configs` 表读取），实现 `fetchByKeywords` 返回 `RawOpinionEvent[]`
  - [ ] 13.5 实现微信公众号适配器 `WeixinAdapter`：对接聚合 API（如新榜/新知魔豆类服务），调用时携带用户在管理端配置的 API Key
  - [ ] 13.6 实现抖音适配器 `DouyinAdapter`、小红书适配器 `XiaohongshuAdapter`、快手适配器 `KuaishouAdapter`、百家号适配器 `BaijiahaoAdapter`、视频号适配器 `WeixinVideoAdapter`，全部走聚合 API 或官方 RSS
  - [ ] 13.7 实现 `WebhookIngestController`：`POST /api/webhook-ingest/:token`，token 是用户在创建 Webhook 时生成的接入令牌，验证 token 有效性后将请求体标准化为 `OpinionEvent` 入库（对应模块8验收4）
  - [ ] 13.8 实现 `AdapterHealthCheckService`：定时（每 5 分钟）调用各适配器 `healthCheck()`，连续 3 次失败则暂停该平台的采集，更新对应监控任务的 `status=error`（对应模块4验收6）
  - [ ] 13.9 实现 `CollectorService`：从 Bull 队列消费 Job，读取任务配置的关键词和平台列表，并行调用各平台适配器，所有结果通过 `OpinionNormalizer` 标准化后插入 `opinion_events`（对应模块8验收5）
  - [ ] 13.10 实现 Bull 队列定义 `TaskQueue`：重复任务按 cron 表达式（5min/15min/30min/60min 对应 `*/5 * * * *` 等），Job data 含 `taskId`、`userId`、`keywords`、`platforms`
  - [ ] 13.11 实现 `KeywordMatcherService`：基于 AC 自动机（Aho-Corasick）算法构建关键词 Trie 树，支持精确匹配、模糊匹配（子串）、排除词，输入 `OpinionEvent.content + title` 输出 `matchedKeywords: string[]`
  - [ ] 13.12 `CollectorService` 采集到原始数据后，先调用 `KeywordMatcherService` 过滤匹配的事件再入库（不匹配的不存储，节省存储）（对应设计文档"关键词匹配引擎"）
  - [ ] 13.13 实现舆情事件去重：基于 Redis 布隆过滤器 `bloom:event:{taskId}:{platform}:{urlHash}`，15 分钟内重复的事件跳过入库（对应设计文档"幂等性"约束1）
  - [ ] 13.14 实现适配器超时控制：所有 `fetchByKeywords` 调用包裹 `Promise.race` 10 秒超时，超时返回空数组并记录日志（对应模块8验收3）
  - [ ]* 13.15 为 `OpinionNormalizer` 编写单元测试，覆盖字段缺失、类型转换、异常数据
  - [ ]* 13.16 为 `KeywordMatcherService` 编写单元测试，覆盖单关键词、多关键词、通配符、排除词、AC 自动机构建正确性
  - [ ]* 13.17 为 `WebhookIngestController` 编写集成测试，验证 token 校验和数据标准化入库
  - [ ]* 13.18 为事件去重布隆过滤器编写单元测试，验证 15 分钟窗口内重复事件被丢弃

- [ ] 14. 检查点 - 数据采集全链路可用
  - 确保监控任务调度 → 适配器采集 → 关键词匹配 → 标准化 → 去重 → 入库 全链路打通

- [ ] 15. 实时舆情大屏（requirements.md 模块6）
  - [ ] 15.1 实现 NestJS WebSocket Gateway `RealtimeGateway`：使用 `@WebSocketGateway` 装饰，`handleConnection` 校验 JWT Token（从 handshake query 或 auth 字段解析），无效则断开连接（对应模块6验收1）
  - [ ] 15.2 实现 Redis Pub/Sub 订阅 `pubsub:opinion:new`，收到消息后通过 `OpinionEvent.userId` 路由到对应 WebSocket 连接的客户端，emit `opinion:new` 事件（对应模块6验收2，设计文档"实时性"约束1）
  - [ ] 15.3 实现 `subscribe:tasks` 和 `unsubscribe:tasks` 事件处理：客户端订阅特定任务后，仅在 `pubsub:opinion:new` 消息中的 `taskId` 在订阅列表内才推送
  - [ ] 15.4 实现 `opinion:stats` 事件：`StatsAggregatorService` 每 5 秒查询 Redis 缓存 `cache:stats:user:{userId}`（缓存命中则直接返回，未命中则查询 MySQL 聚合统计），统计内容含总舆情数、各平台占比、情感分布、最近 24 小时趋势曲线数据点（对应模块6验收6）
  - [ ] 15.5 实现 `StatsCacheService`：定时（每 30 秒）刷新所有活跃用户的统计缓存到 Redis，避免大屏每次都查 MySQL
  - [ ] 15.6 后端在 `opinion_events` 入库后立即 publish 到 Redis `pubsub:opinion:new`（在 `CollectorService` 入库事务后调用 `RedisService.publish`）
  - [ ] 15.7 前端用户端实现实时大屏页：基于 ECharts 实现「总舆情数卡片」+「各平台占比饼图」+「情感分布饼图」+「24h 趋势曲线」+「实时舆情事件流卡片」，使用 `socket.io-client` 连接 WebSocket，监听 `opinion:new` 追加到事件流、监听 `opinion:stats` 更新统计卡片（对应模块6验收1-6）
  - [ ] 15.8 前端实现平台筛选器和关键词筛选器：切换筛选条件时通过 `subscribe:tasks` 事件通知服务端只推送过滤后的事件（对应模块6验收4、验收5）
  - [ ] 15.9 前端实现舆情事件点击行为：新窗口打开 `event.url`（对应模块6验收3）
  - [ ] 15.10 实现端到端延迟监控：后端在 publish 时附带 `publishedAt` 时间戳，前端收到时计算延迟，超过 3 秒打点告警日志
  - [ ]* 15.11 为 `RealtimeGateway` 连接鉴权编写集成测试，验证无效 Token 拒绝连接
  - [ ]* 15.12 为 `StatsAggregatorService` 编写单元测试，验证统计数据正确性
  - [ ]* 15.13 为大屏编写 E2E 测试，模拟 WebSocket 推送后页面数据正确更新

- [ ] 16. 检查点 - 实时大屏可用
  - 确保数据采集 → 入库 → Redis Pub/Sub → WebSocket 推送 → 前端渲染全链路延迟 < 3 秒

- [ ] 17. Webhook 机器人与告警推送（requirements.md 模块5）
  - [ ] 17.1 实现 `WebhookService`：CRUD 均强制 `userId` 条件（对应模块10验收1）
  - [ ] 17.2 实现 `POST /api/webhooks`：参数校验（name、url、format 枚举）、生成 `secretKey`（若用户填写则用用户值）、生成 `ingestToken`（用于 `webhook-ingest` 接收数据）（对应模块5验收1）
  - [ ] 17.3 实现 `POST /api/webhooks/:id/test`：构造测试 payload，按 `format` 字段选择对应 payload 模板，HTTP POST 到 `url`，5 秒超时，返回连通性结果（对应模块5验收2）
  - [ ] 17.4 实现 `PayloadTemplateService`：根据 `format` 渲染对应格式（企业微信 markdown、钉钉 actionCard、飞书 interactive card、自定义 JSON 模板），自定义模式支持 `{{platform}}` 等变量替换（对应设计文档"用户端 Webhook 数据推送格式"）
  - [ ] 17.5 实现 `WebhookPusherService`：从 `webhook_task_bindings` 查询所有与触发舆情事件的 `taskId` 关联的 Webhook，对每个 Webhook 调用 `PayloadTemplateService.render` 生成 payload，HTTP POST 推送
  - [ ] 17.6 在 `opinion_events` 入库 + Redis publish 后，创建 Bull Job `webhook-push`，Job data 含 `eventId`、`webhookIds`，由 `WebhookPusherService` 消费执行（对应模块5验收3）
  - [ ] 17.7 实现指数退避重试：推送返回 4xx/5xx 时按 5s/15s/45s 间隔重试最多 3 次，3 次失败则更新 `webhooks.status=error` 并写入 `webhook_push_logs`（对应模块5验收4）
  - [ ] 17.8 实现 Webhook 签名：若 `webhooks.secret_key` 非空，则在请求头加 `X-Signature: HMAC-SHA256(payload, secret_key)`（对应模块5验收1）
  - [ ] 17.9 实现定时推送 Job：`@nestjs/schedule` 的 cron 触发，查询所有 `pushPeriodic=1` 的 Webhook，按 `periodicFreq` 调度（`hourly`、`every_6h`、`daily`），聚合该 Webhook 关联任务在时间窗口内的新增舆情事件，渲染汇总报告 payload 推送（对应模块5验收5）
  - [ ] 17.10 实现 `GET /api/webhooks/:id/logs` 返回推送日志分页列表
  - [ ] 17.11 前端用户端实现 Webhook 管理页：Webhook 列表 + 创建/编辑表单（含格式选择预览）+ 测试按钮 + 推送日志查看
  - [ ]* 17.12 为 `PayloadTemplateService` 编写单元测试，覆盖四种格式的 payload 渲染正确性
  - [ ]* 17.13 为 `WebhookPusherService` 编写集成测试，mock HTTP 响应 200/4xx/5xx/timeout 四种场景验证重试逻辑
  - [ ]* 17.14 为定时推送 Job 编写单元测试，验证时间窗口聚合逻辑

- [ ] 18. 检查点 - Webhook 告警可用
  - 确保命中即推、定时推送、四种格式模板、签名计算、重试逻辑全部端到端跑通

- [ ] 19. 短信告警通知与紧急通知（requirements.md 模块9 验收4）
  - [ ] 19.1 实现 `SmsAlertService.sendUrgentAlert(userId, event)`：当舆情事件标记为紧急（关键词包含管理端配置的"敏感词白名单"或情感倾向为强负面且阅读量超阈值）时，通过 `SmsService.sendSms` 发送短信告警（对应模块9验收4）
  - [ ] 19.2 在 Webhook 规则中新增字段 `sms_alert_enabled`（bool），仅用户开启时才发短信告警，避免短信费用失控
  - [ ] 19.3 在 `WebhookPusherService` 推送成功后，检查事件是否满足紧急通知条件 + 用户是否开启短信告警，满足则调用 `SmsAlertService.sendUrgentAlert`
  - [ ]* 19.4 为紧急短信告警触发条件编写单元测试

- [ ] 20. 检查点 - 短信告警可用
  - 确保紧急舆情事件可触发短信通知，且仅在用户开启时触发

- [ ] 21. 系统日志与监控（requirements.md 设计文档错误处理章节）
  - [ ] 21.1 实现全局 `SystemLogInterceptor`：所有 API 请求记录到 `system_logs`，含 `operatorId`、`module`、`action`、`detail`、`ipAddress`、`level`
  - [ ] 21.2 实现 `GET /api/admin/system/logs`：分页 + 按 `module`/`level`/时间段筛选
  - [ ] 21.3 前端管理端实现系统日志页：日志列表 + 筛选栏 + 日志详情展开
  - [ ]* 21.4 为日志拦截器编写单元测试，验证字段完整记录

- [ ] 22. 检查点 - 日志监控可用
  - 确保所有 API 请求和系统事件可追溯

- [ ] 23. 前端公共能力与 UX 完善
  - [ ] 23.1 实现前端共享组件库 `frontend-shared/`（pnpm workspace 内部包）：`DataTable`、`RealTimeChart`、`PlatformTag`、`SentimentBadge`、`WebhookTestButton`、`KeywordInput`
  - [ ] 23.2 实现前端统一错误处理：网络错误 toast 提示、401 跳登录、403 显示封禁页、422 显示表单校验错误
  - [ ] 23.3 实现用户端首页 Dashboard：展示监控任务数、今日新增舆情数、活跃 Webhook 数、最近告警列表
  - [ ] 23.4 实现管理端首页 Dashboard：展示总用户数、今日新增用户、今日短信发送量、系统健康状态
  - [ ] 23.5 实现前端国际化（vue-i18n），支持中英文切换
  - [ ] 23.6 实现前端主题色和响应式布局，支持移动端基本访问
  - [ ]* 23.7 为共享组件库编写单元测试（Vitest + Vue Test Utils）

- [ ] 24. 检查点 - 前端 UX 完善
  - 确保所有页面交互流畅，错误处理完善，移动端基本可用

- [ ] 25. 安全加固与性能优化
  - [ ] 25.1 配置 Nginx 强制 HTTPS、HSTS、CSP 头部
  - [ ] 25.2 实现登录接口限流（基于 IP，10 次/分钟）、其他接口限流（基于 userId，60 次/分钟），超限返回 429（对应设计文档"安全设计"约束7）
  - [ ] 25.3 实现前端 XSS 防护：所有用户输入渲染前 HTML 转义，Vue 默认转义 `{{ }}` 已生效，v-html 用例需手动 sanitize
  - [ ] 25.4 审计所有 SQL 查询，确认均使用 TypeORM 参数化查询，无字符串拼接 SQL（防 SQL 注入）
  - [ ] 25.5 为 `opinion_events` 大表添加分区策略（按月分区），编写迁移脚本
  - [ ] 25.6 为 `monitor_tasks`、`webhooks` 等表添加 `(user_id, id)` 联合索引，加速用户维度查询
  - [ ] 25.7 实现后端健康检查端点 `GET /api/health` 返回数据库、Redis、Bull 队列状态
  - [ ] 25.8 配置后端日志按天切割 + 保留 30 天，错误日志单独文件
  - [ ]* 25.9 为限流逻辑编写单元测试
  - [ ]* 25.10 为参数化 SQL 查询编写安全审计测试，验证无注入风险

- [ ] 26. 检查点 - 安全与性能达标
  - 确保限流生效、HTTPS 强制、SQL 注入防护、大表分区就绪

- [ ] 27. Docker 化部署与文档
  - [ ] 27.1 编写后端 Dockerfile（多阶段构建，builder 阶段安装依赖编译 TypeScript，runtime 阶段仅复制 dist 和 node_modules，基础镜像 `node:20-alpine`）
  - [ ] 27.2 编写前端 Dockerfile（builder 阶段 `pnpm build`，runtime 阶段用 `nginx:alpine` 托管 dist 静态资源）
  - [ ] 27.3 完善 `docker/docker-compose.yml`：定义 `mysql`、`redis`、`backend`、`frontend-admin`、`frontend-user`、`nginx` 六个服务，配置 healthcheck 和 depends_on
  - [ ] 27.4 编写 `docker/nginx/nginx.conf`：配置反向代理 `/api` → `backend:3000`、`/socket.io` → `backend:3000`、管理端和用户端静态资源分别路由
  - [ ] 27.5 编写 `.env.example` 列出所有环境变量及说明（DB、Redis、JWT_SECRET、AES_ENCRYPTION_KEY、PORT 等），不包含任何真实凭据
  - [ ] 27.6 编写 `README.md` 包含项目简介、技术栈、启动步骤、Docker 部署、开发指南
  - [ ] 27.7 编写 `docs/API.md` 列出所有 REST API 和 WebSocket 事件
  - [ ] 27.8 编写启动脚本 `docker/start.sh` 一键拉起所有服务并执行迁移和 seed
  - [ ]* 27.9 编写部署后的端到端冒烟测试脚本

- [ ] 28. 最终检查点 - 系统就绪
  - 确保所有功能端到端跑通，Docker 部署成功，文档完整

## 任务统计

| Epic | 任务数 | 必做 | 可选 |
|------|--------|------|------|
| 1. 基础设施 | 11 | 9 | 2 |
| 3. 数据库 Schema | 10 | 9 | 1 |
| 5. 认证模块 | 17 | 14 | 3 |
| 7. 阿里云配置与短信 | 11 | 9 | 2 |
| 9. 用户管理 | 6 | 5 | 1 |
| 11. 监控任务 CRUD | 11 | 9 | 2 |
| 13. 数据采集适配器 | 18 | 14 | 4 |
| 15. 实时大屏 | 13 | 10 | 3 |
| 17. Webhook 推送 | 14 | 11 | 3 |
| 19. 短信告警通知 | 4 | 3 | 1 |
| 21. 系统日志 | 4 | 3 | 1 |
| 23. 前端 UX 完善 | 7 | 6 | 1 |
| 25. 安全与性能 | 10 | 8 | 2 |
| 27. Docker 部署 | 9 | 8 | 1 |
| **总计** | **145** | **118** | **27** |

含 14 个检查点用于阶段性验收。
