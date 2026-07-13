# 全网舆情监测系统

覆盖微信公众号、视频号、抖音、小红书、快手、微博、百家号等主流平台的全网舆情监测系统，采用管理端与用户端分离架构。

## 核心特性

- 管理端与用户端分离
- 阿里云短信登录/注册/通知
- 阿里云手机号三要素详细版实名认证
- Webhook 机器人（企业微信/钉钉/飞书/自定义 JSON）
- 关键词监控舆论
- 全网舆情实时大屏
- 实时数据更新（WebSocket + Redis Pub/Sub）
- 用户管理（封禁/解封）
- 所有功能互通，无硬编码

## 技术栈

- **后端**：NestJS + TypeScript + TypeORM + Bull + Socket.IO
- **前端管理端/用户端**：Vue 3 + Vite + TypeScript + Pinia + Element Plus + ECharts
- **数据库**：MySQL 8.0
- **缓存/队列**：Redis 7.x + Bull Queue
- **部署**：Docker Compose + Nginx

## 项目结构

```
/workspace
├── backend/                    NestJS 后端 API
│   ├── src/
│   │   ├── modules/           业务模块
│   │   │   ├── auth/          认证
│   │   │   ├── admin/         管理端
│   │   │   ├── monitor-tasks/ 监控任务
│   │   │   ├── webhooks/      Webhook 机器人
│   │   │   ├── realtime/      WebSocket 实时大屏
│   │   │   ├── collector/     数据采集适配器
│   │   │   ├── sms/           阿里云短信
│   │   │   ├── verify/        三要素认证
│   │   │   └── system-logs/   系统日志
│   │   ├── database/          数据库实体 + 迁移
│   │   ├── redis/             Redis 封装
│   │   └── utils/             工具类
│   └── Dockerfile
├── frontend-admin/             管理端 SPA
├── frontend-user/              用户端 SPA
├── docker/                     Docker Compose 部署配置
└── .monkeycode/specs/         需求文档、技术设计、任务列表
```

## 快速启动（开发模式）

### 1. 启动数据库

```bash
cd docker
docker compose up -d mysql redis
```

### 2. 后端启动

```bash
cd backend
cp ../.env.example .env
# 编辑 .env，填入 AES_ENCRYPTION_KEY、JWT_SECRET 等
# 生成密钥: openssl rand -base64 32
pnpm install
pnpm migration:run
pnpm seed          # 创建 admin 账号（默认 admin/123456）
pnpm dev
```

后端将在 http://localhost:3000 运行。

### 3. 前端启动

```bash
# 管理端
cd frontend-admin
pnpm install
pnpm dev          # http://localhost:5174

# 用户端
cd frontend-user
pnpm install
pnpm dev          # http://localhost:5173
```

### 4. 默认账号

- **管理端**：访问 http://localhost:5174，使用 `admin / 123456` 登录
- **首次登录**：系统强制要求修改默认密码

## Docker 一键部署

```bash
cd docker
cp .env.example .env
# 编辑 .env 配置阿里云凭据和数据源 API Key
docker compose up -d
docker compose exec backend pnpm migration:run
docker compose exec backend pnpm seed
```

完成后访问：
- 管理端：http://localhost/admin/
- 用户端：http://localhost/user/
- API：http://localhost/api/

## 阿里云配置

进入管理端 `/config/aliyun-sms` 和 `/config/aliyun-verify` 页面，配置：

1. **短信服务**
   - AccessKey ID / Secret
   - 短信签名
   - 模板 CODE（需含 `{code}` 变量）

2. **三要素认证**
   - AccessKey ID / Secret
   - 产品 CODE（阿里云市场购买手机号三要素详细版获取）

所有凭据使用 AES-256-CBC 加密存储，禁止硬编码。

## 平台数据源配置

各平台适配器从环境变量读取聚合 API 配置：

```bash
WEIBO_API_BASE=https://your-aggregator.com/weibo
WEIBO_API_KEY=sk-xxxxxx
WEIXIN_API_BASE=https://...
WEIXIN_API_KEY=sk-xxxxxx
# 其他平台类似
```

如未配置对应平台，适配器返回空数组不影响其他平台运行。

## 用户端使用流程

1. 注册（手机号 + 验证码 + 密码）
2. 完成三要素认证（真实姓名 + 身份证号 + 手机号）
3. 创建监控任务（关键词 + 平台 + 频率）
4. 创建 Webhook 机器人（绑定到任务）
5. 进入实时大屏查看舆情

## 文档

完整需求文档、技术设计、任务列表位于：

- `当前工作区/.monkeycode/specs/public-opinion-monitor/requirements.md`
- `当前工作区/.monkeycode/specs/public-opinion-monitor/design.md`
- `当前工作区/.monkeycode/specs/public-opinion-monitor/tasklist.md`
