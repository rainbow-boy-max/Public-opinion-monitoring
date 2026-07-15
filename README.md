# 全网舆情监测系统

覆盖微信公众号、视频号、抖音、小红书、快手、微博、百家号等主流平台的全网舆情监测系统，采用管理端与用户端分离架构。支持 LLM 大模型管理、AI 智能体编排、知识库 RAG、联网搜索等 AI 能力。

## 核心特性

- **管理端与用户端分离**：独立 SPA，通过后端统一鉴权
- **LLM 大模型管理**：内置 9 家厂商（OpenAI、DeepSeek、通义千问、智谱、Kimi、硅基流动、MiniMax、火山方舟、百度千帆），支持 OpenAI / Anthropic 双协议
- **AI 智能体**：自定义大模型智能体，支持图片理解、推理思考、联网搜索能力
- **AI 知识库**：文档自动解析 → AI 打分 → 向量化 → RAG 检索；支持 PDF / Word / PPT / TXT / MD / HTML
- **Web 搜索集成**：9 种搜索 Provider（DuckDuckGo / Brave / 百度千帆 / 阿里云百炼 / 火山方舟 / DeepSeek / 博查 / 秘塔 / Tavily）
- **联网搜索测试**：SSE 流式实时日志，步骤级可视化
- **多厂商 AI 模型**：一键接入，支持 API Key 自动启用/禁用、批量操作、拖拽排序
- **阿里云短信**：登录/注册/通知/预警
- **阿里云手机号三要素**：详细版实名认证
- **Webhook 机器人**：企业微信/钉钉/飞书/自定义 JSON
- **关键词监控舆论**：7 大平台，端到端延迟 < 3 秒
- **全网舆情实时大屏**：WebSocket + Redis Pub/Sub
- **用户管理**：封禁/解封/重置密码
- **AES-256-CBC 加密**：所有敏感凭据加密存储

## 技术栈

- **后端**：NestJS + TypeScript + TypeORM + Bull + Socket.IO
- **前端管理端**：Vue 3 + Vite + TypeScript + Pinia + Element Plus + ECharts
- **前端用户端**：Vue 3 + Vite + TypeScript + Pinia + Element Plus + ECharts
- **数据库**：MySQL 8.0（开发 / 生产）/ SQLite（零外部依赖模式）
- **缓存/队列**：Redis 7.x + Bull Queue
- **部署**：Docker Compose（开发）/ 单容器 Alpine 镜像（展示）

## 项目结构

```
/workspace
├── backend/                          NestJS 后端 API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                认证（JWT）
│   │   │   ├── admin/               管理端（仪表盘、用户、审计、Dashboard SSE）
│   │   │   ├── agents/              AI 智能体（Llm 路由、能力编排）
│   │   │   ├── knowledge/           AI 知识库（打分、向量检索、RAG）
│   │   │   ├── monitor-tasks/       监控任务
│   │   │   ├── webhooks/            Webhook 机器人
│   │   │   ├── realtime/            WebSocket 实时大屏
│   │   │   ├── collector/           数据采集适配器
│   │   │   ├── sms/                 阿里云短信
│   │   │   ├── verify/              三要素认证
│   │   │   └── system-logs/         系统日志
│   │   ├── database/                数据库实体 + 迁移
│   │   ├── redis/                   Redis 封装
│   │   └── utils/                   工具类
│   ├── Dockerfile
│   └── init.sql                     数据库初始化脚本
├── frontend-admin/                  管理端 SPA
├── frontend-user/                   用户端 SPA
├── docker/                          Docker Compose 部署配置
└── .monkeycode/specs/               需求文档、技术设计、任务列表
```

## 快速启动（开发模式）

### 1. 启动基础设施

```bash
cd docker
docker compose up -d mysql redis
```

### 2. 后端启动

```bash
cd backend
cp ../.env.example .env
# 编辑 .env 填入必要密钥
# 生成 AES 密钥: openssl rand -base64 32
pnpm install
pnpm migration:run
pnpm seed          # 创建 admin 账号（默认 admin/123456）
pnpm dev           # http://localhost:3000
```

### 3. 前端启动

```bash
# 管理端
cd frontend-admin
pnpm install
pnpm dev           # http://localhost:5174

# 用户端
cd frontend-user
pnpm install
pnpm dev           # http://localhost:5173
```

### 4. 默认账号

- **管理端**：`http://localhost:5174`，使用 `admin / 123456` 登录
- **首次登录**：系统强制要求修改默认密码

## 零外部依赖模式（SQLite）

可在无 MySQL / Redis 的环境下运行，后端使用 SQLite 替代 MySQL：

```bash
cd backend
pnpm install
pnpm run build

DB_TYPE=sqlite DB_DATABASE_FILE=/data/app.db node dist/main.js
```

## Docker 一键部署（开发）

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

## 单容器生产镜像（Showcase 部署）

完整的全栈镜像（后端 + 管理端 + 用户端），适合部署到：

### 构建前提

| 项 | 要求 |
|---|---|
| 系统 | Linux amd64 / macOS |
| 内存 | ≥ 4GB |
| 磁盘 | ≥ 10GB |
| 工具 | `pnpm >= 9`, `node >= 20`, `docker` |

### 构建命令

```bash
# 1. 安装依赖
CI=true pnpm install

# 2. 构建前端
cd frontend-admin && node node_modules/vite/bin/vite.js build
cd ../frontend-user && node node_modules/vite/bin/vite.js build

# 3. 编译后端
cd ../backend && pnpm run build

# 4. 提取后端生产依赖（扁平化，不含软链）
rm -rf /tmp/backend-deploy
cd .. && pnpm --filter backend deploy --legacy /tmp/backend-deploy

# 5. 准备 Docker context
rm -rf /tmp/ctx && mkdir -p /tmp/ctx
cp -r /tmp/backend-deploy/node_modules /tmp/ctx/node_modules
mkdir -p /tmp/ctx/backend && cp -r backend/dist /tmp/ctx/backend/dist
cp backend/package.json /tmp/ctx/backend/
mkdir -p /tmp/ctx/public/admin && cp -r frontend-admin/dist/* /tmp/ctx/public/admin/
mkdir -p /tmp/ctx/public/user && cp -r frontend-user/dist/* /tmp/ctx/public/user/

# 6. 构建容器镜像
docker build --network host -t showcase:latest -f - /tmp/ctx <<'DOCKERFILE'
FROM alpine:3.20
RUN apk add --no-cache nodejs~=20 tini curl
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY node_modules /app/backend/node_modules
COPY backend/dist /app/backend/dist
COPY backend/package.json /app/backend/
RUN mkdir -p /app/public/admin /app/public/user
COPY public/ /app/public/
RUN mkdir -p /data && chown -R app:app /data /app
ENV NODE_ENV=production PORT=3000 DB_TYPE=sqlite DB_DATABASE_FILE=/data/app.db
EXPOSE 3000
USER app
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/app/backend/dist/main.js"]
DOCKERFILE

# 7. 验证镜像
docker images showcase:latest --format '{{.Size}}'
# 应 ≤ 500MB

# 8. 本地启动验证
docker run -d --rm --name showcase-test --network=host \
  -e DB_DATABASE_FILE=/data/app.db showcase:latest
sleep 8
curl -I http://127.0.0.1:3000

# 9. 导出镜像
docker save showcase:latest | gzip -1 > /tmp/showcase-image.tar.gz
ls -la /tmp/showcase-image.tar.gz
```

### 上传到 Showcase

```bash
curl -X POST \
  -F "client_id=$(hostname)" \
  -F "kind=backend" \
  -F "site_name=舆情监测系统" \
  -F "site_author=你的名字" \
  -F "site_description=面向舆情监测运营者的统一管理控制台，覆盖 LLM 模型、知识库、智能体、Web 搜索等模块。" \
  -F "site_image=@/tmp/showcase-image.tar.gz" \
  -F "service_port=3000" \
  -F "healthcheck_path=/" \
  https://ugc-submit.showcase.monkeycode-ai.online/v1/create
```

## 管理端功能总览

| 页面 | 路径 | 功能说明 |
|---|---|---|
| 概览 | `/dashboard` | KPI 卡片、趋势图、平台分布、实时活动 SSE |
| 用户管理 | `/users` | 注册用户列表、封禁/解封、重置密码、角色筛选 |
| AI 智能体 | `/agents` | 自定义智能体、能力声明、模型选择、知识库关联 |
| LLM 大模型 | `/llm-models` | 9 家厂商预置 + 自定义；批量启用/禁用；拖拽排序；一键初始化 |
| AI 知识库 | `/knowledge` | 文件上传、AI 解析/打分/摘要、向量检索、RAG 测试 |
| 短信配置 | `/config/aliyun-sms` | 阿里云短信接入配置 |
| 短信模板 | `/sms-templates` | 7 大场景短信模板管理 + 一键报备 |
| 三要素认证 | `/config/aliyun-verify` | 阿里云手机号三要素详细版 |
| Web 搜索 | `/config/web-search` | 9 种搜索 Provider 配置与 SSE 实时测试 |
| AI 打分 | `/config/kb-scoring` | 知识库文档 AI 评分模型与能力配置 |
| 系统日志 | `/system-logs` | API 请求与异常记录 |

## AI 能力详解

### LLM 模型管理
- 预置 9 家厂商共 38+ 个模型（含 MiniMax-M3 / DeepSeek-R1 / Qwen-Max 等）
- 支持 OpenAI 兼容与 Anthropic 兼容双协议
- API Key 自动推断 isEnabled（未配置自动禁用）
- 批量操作、拖拽排序、一键恢复预置

### AI 智能体
- 自定义角色描述与系统 Prompt
- 主用模型 + 5 个备用模型 failover 链
- 能力声明：图片理解 / 推理思考 / 联网搜索
- 模型能力自动判断：选模型后自动勾选支持的能力
- 知识库多对多关联

### AI 知识库
- 多格式文件上传（PDF / Word / PPT / TXT / MD / HTML）
- AI 自动解析 → 文本降噪 → 智能分块
- AI 相关性评分（基于配置的 LLM 模型，0-100 分）
- 联网搜索增强评分（辅助判断文档真实性）
- 向量化 + 余弦相似度检索
- 文件内容在线预览与编辑

### Web 搜索
- DuckDuckGo（免 Key，含 Instant Answer fallback）
- Brave Search API
- 百度千帆 BaiduSearch
- 阿里云百炼 web_search
- 火山方舟联网内容插件
- DeepSeek 内置联网
- 博查中文搜索 / 秘塔 AI 搜索 / Tavily Search
- SSE 流式实时测试日志

## 阿里云配置

进入管理端 `系统设置` 页面配置阿里云服务：

1. **短信服务**：AccessKey ID / Secret + 短信签名 + 模板 CODE
2. **三要素认证**：AccessKey ID / Secret + 产品 CODE

所有凭据使用 AES-256-CBC 加密存储。

## 平台数据源配置

各平台适配器从环境变量读取聚合 API 配置：

```bash
WEIBO_API_BASE=https://your-aggregator.com/weibo
WEIBO_API_KEY=sk-xxxxxx
WEIXIN_API_BASE=https://...
WEIXIN_API_KEY=sk-xxxxxx
# 其他平台类似
```

如未配置，适配器返回空数组不影响其他平台运行。

## 用户端使用流程

1. 注册（手机号 + 验证码 + 密码）
2. 完成三要素认证（真实姓名 + 身份证号 + 手机号）
3. 创建监控任务（关键词 + 平台 + 频率）
4. 创建 Webhook 机器人（绑定到任务）
5. 进入实时大屏查看舆情

## 文档

完整需求文档、技术设计、任务列表位于：

- `当前工作区/.monkeycode/specs/public-opinion-monitor/`
- `当前工作区/.monkeycode/specs/260714-fix-admin-experience/`
- `当前工作区/.monkeycode/specs/260716-admin-commercial-readiness/`
- `当前工作区/.monkeycode/specs/260718-admin-v2-round/`
- `当前工作区/.monkeycode/specs/260718-llm-admin-upgrade-v2/`
