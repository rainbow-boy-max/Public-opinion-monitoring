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

---

## 更新日志

### 2026-07-19 — Phase 2：值班面板 WebSocket + 系统日志审计
- **值班面板 WebSocket 完整实现**：后端新增 `DutyModule`，实现 Socket.IO Gateway 监听 `/duty` 命名空间，`DutyService` 聚合 24h 事件数、告警数、平台/情感分布，每 30 秒自动推送最新数据，提供 REST fallback `GET /duty/overview`
- **系统日志审计上报**：后端新增 `POST /admin/audit-events/record` 端点支持前端操作上报，前端新增 `utils/audit.ts` 工具函数，审计失败静默处理不阻塞主流程
- **data-source.ts 实体注册**：`OcrConfigEntity` 已添加到 TypeORM 数据源配置

### 2026-07-19 — Phase 1：核心功能整改（OCR 配置 + 强制改密）
- **OCR 识别配置升级**：新增主备模型配置功能，支持选择主模型和最多 5 个备用模型，识别失败时自动切换，提升容错能力
  - 后端新增 `OcrConfigEntity` 实体存储配置
  - `OcrService.recognizeImage()` 改为主备模型重试逻辑
  - 前端 `OcrConfigPage` 新增主模型下拉框 + 备用模型多选（最多 5 个），带表单校验
  - 配置持久化，刷新后保持
- **强制改密流程完善**：使用初始密码（`admin/123456`）登录后，弹出不可关闭的强制改密对话框，改密前无法访问其他页面
  - 登录成功检查 `passwordChangeRequired` 标记
  - 弹出不可关闭的 `ElMessageBox`，只能点击「立即修改」
  - 路由守卫拦截未改密用户，强制跳转 `/change-password`
  - 改密成功后清除 `localStorage` 标记，恢复正常访问
- **整改方案文档**：新增 `.monkeycode/整改方案-260719.md`，详细记录 8 个问题的根因分析、整改方案、实施计划与验收标准

### 2026-07-18 — 管理端 StatCard 统计卡显示修复
- **工单管理页**：统计卡 props 与 `StatCard` 组件对齐，`title`/`color`/`icon="clock"` 改为 `label`/`icon-bg` + emoji 图标，修复红框内显示为 `clock 0` / `search1` 等文字的问题
- **电商监测配置页**：同样修正 `StatCard` 的 `title`/`color` 误用，统一为 `label` + emoji + 渐变 `icon-bg`
- 四个工单统计卡现为：待处理 / 分析中 / 已解决 / 已关闭，图标与数值正常渲染

### 2026-07-17 — Phase 1: 多模态识别 + 电商监测 + 报告模板
- **多模态OCR识别**：利用 LLM vision 能力识别图片文字，管理端 `OcrConfigPage` 配置页 + OCR 测试
- **电商平台监测**：京东/淘宝/拼多多评论口碑监测，管理端 `EcommerceConfigPage` + 用户端 `EcommercePage`
- **报告模板市场**：5 种预设模板（日报/周报/事件专报/竞品对标/自定义），管理端 `ReportTemplatesPage`
- 新增后端模块：`ocr`, `ecommerce`, `report-templates`
- 自定义分析对话框：三种输入（选择事件/输入链接/上传文档）+ AI 智能体生成解决方案
- 新增 `POST /pr/fetch-url` 链接内容抓取 + `GET /pr/events/search` 事件搜索
- 登录页三 Tab 切换：账号密码/手机密码/手机验证码
- 后端 `LoginDto` 扩展支持 `phone`+`code` 认证

### 2026-07-15 — Phase 4 商业增值功能
- **品牌声誉管理面板**：NPS/声量/竞品对比 + 4 种 ECharts 图表
- **人工研判工单系统**：全流程 CRUD + 文件上传 + 评分
- **行业知识图谱**：LLM 实体抽取 + ECharts 力导向图 + 主/备模型配置
- **多租户支持**：`TENANT_ENABLED` 开关 + AsyncLocalStorage 隔离
- **MiniMax TTS 国内版** + **小米 MiMo-V2.5-TTS** 双供应商策略模式
- **情感分析增强**：规则+LLM 双通道
- **Webhook 出站**：Zabbix + 飞书机器人

### 2026-07-15 — Phase 3 体验增强
- 暗色/亮色主题切换（useTheme composable）
- 预警阈值可视化（el-slider + 动态表单）
- AI 关键词扩展（LLM 智能推荐 + 监控任务嵌入）
- 操作审计日志（@AuditLog 装饰器 + 全局拦截器 + CSV 导出）
- 数据导出订阅（CSV/JSON 导出 + 定时订阅）
- 多维对比分析（对比组构建器 + ECharts 堆叠柱状/折线/雷达图）
- AI 智能体市场模板（12 套预置模板 + 一键部署）
- 自定义舆情大屏（7 种拖拽 widget）
- 短视频专项监测（抖音/快手/小红书增强 + 视频卡片）
- 微信小程序端（完整工程 + 6 页面）

### 2026-07-15 — Phase 2 竞品能力补齐
- 传播路径追踪（ECharts 力导向关系图）
- 事件脉络梳理（时间轴 + 关键节点标记）
- 自动舆情报告（日报/周报/订阅 + Markdown 导出）
- 竞品动态追踪（4 种对比图表 + 竞品组管理）
- 热点话题发现（1h 滑动窗口 + 增长率评分）

### 2026-07-15 — Phase 1 基础修复与预警
- P0 缺陷修复 6 项（Webhook 校验/Adapter 降级/ENUM 迁移/登录重定向/报告导出/SSE 数据流）
- AI 预警中心（规则引擎 + 分钟级 Cron 检查 + 管理端/用户端双界面）
- 实时大屏增强（4 统计卡片 + 情感趋势折线图 + 平台饼图 + 热词标签）

### 2026-07-13 — Phase 0 初始版本
- 管理端/用户端分离架构搭建
- LLM 模型管理（9 厂商预置 + 支持 OpenAI/Anthropic 双协议）
- AI 智能体 + 知识库 + Web 搜索
- 7 平台数据采集适配器
- 阿里云短信/三要素认证
- Webhook 机器人（企业微信/钉钉/飞书/自定义 JSON）
- 实时大屏（WebSocket + Redis Pub/Sub）
- 关键词监控任务（7 大平台，端到端 < 3 秒）

---

*README 最后更新: 2026-07-19*
