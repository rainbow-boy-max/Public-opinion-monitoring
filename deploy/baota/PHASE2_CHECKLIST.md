# Phase 2 验收清单

## 已交付文件

| 文件                                       | 功能                                                       | 状态 |
| ------------------------------------------ | ---------------------------------------------------------- | ---- |
| `scripts/opinionctl`                       | 受控命令入口（status、health、start、stop、restart、logs） | ✅   |
| `console/server.mjs`                       | 部署控制台 API 服务（Express）                             | ✅   |
| `console/package.json`                     | 控制台依赖清单                                             | ✅   |
| `console/public/index.html`                | 控制台 Vue 3 前端                                          | ✅   |
| `scripts/start-console.sh`                 | 控制台启动脚本                                             | ✅   |
| `console/nginx-console.conf.template`      | 控制台 Nginx 反向代理模板                                  | ✅   |
| `console/opinion-console.service.template` | 控制台 systemd 服务模板                                    | ✅   |

## 脚本语法验证

- ✅ `opinionctl` 语法检查通过
- ✅ `start-console.sh` 语法检查通过
- ✅ `install.sh` 更新后语法检查通过
- ✅ `server.mjs` Node 语法检查通过

## 核心功能

### opinionctl 白名单命令

- ✅ `status`：获取 MySQL、Redis、后端容器状态（JSON）
- ✅ `health`：健康检查（healthy/starting/unhealthy）
- ✅ `start`：启动所有服务
- ✅ `stop`：停止所有服务
- ✅ `restart`：重启所有服务
- ✅ `logs [服务] [行数]`：查看容器日志

### 部署控制台 API

- ✅ `GET /api/status`：容器状态
- ✅ `GET /api/health`：健康检查
- ✅ `POST /api/start`：启动服务
- ✅ `POST /api/stop`：停止服务
- ✅ `POST /api/restart`：重启服务
- ✅ `GET /api/logs/:service?`：查看日志
- ✅ `GET /api/system-info`：系统磁盘与内存信息

### 部署控制台前端

- ✅ 实时显示 MySQL、Redis、后端健康状态
- ✅ 服务启动、停止、重启按钮
- ✅ 每 30 秒自动刷新健康状态
- ✅ 分服务查看日志（全部/MySQL/Redis/后端）
- ✅ 状态徽章（健康/启动中/异常/未知）
- ✅ 响应式布局（Element Plus）

## 安全机制

- ✅ 控制台 API 仅监听 `127.0.0.1:8888`
- ✅ `localOnlyMiddleware` 拒绝非本机来源
- ✅ 通过宝塔 Nginx Basic Auth 反向代理访问
- ✅ `opinionctl` 白名单操作，拒绝任意 Shell 执行
- ✅ 日志记录到 `$RUNTIME_ROOT/logs/opinionctl.log`

## 部署流程

### 1. Phase 1 安装

```bash
cd /workspace/deploy/baota
bash install.sh --domain opinion.example.com
```

### 2. 启动部署控制台

```bash
bash /www/server/opinion-monitor/scripts/start-console.sh
```

### 3. 配置宝塔 Nginx

将 `/www/server/opinion-monitor/nginx/opinion-console.conf` 追加到站点配置：

```nginx
location /deploy-console/ {
    auth_basic "Deployment Console";
    auth_basic_user_file /www/server/opinion-monitor/console/.htpasswd;

    proxy_pass http://127.0.0.1:8888/;
    ...
}
```

创建 Basic Auth 密码文件：

```bash
htpasswd -c /www/server/opinion-monitor/console/.htpasswd admin
```

### 4. 访问控制台

访问 `https://opinion.example.com/deploy-console/`，输入 Basic Auth 凭据。

### 5. 在控制台中启动服务

点击「启动服务」，等待健康检查通过。

## Phase 2 限制

Phase 2 **不包含**：

- 镜像拉取与构建
- 前端发布
- 数据库迁移
- 版本升级
- 备份恢复
- 分级卸载

这些功能将在 Phase 3-6 实现。

## 依赖要求

- Node.js 20+
- Docker Engine
- Docker Compose Plugin
- jq（用于 JSON 解析）
- 宝塔面板（可选，用于 Nginx 反向代理）

## 目录结构

```text
/www/server/opinion-monitor/
├── console/
│   ├── server.mjs
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   ├── .htpasswd (手动创建)
│   ├── nginx-console.conf.template
│   └── opinion-console.service.template
├── scripts/
│   ├── opinionctl
│   ├── start-console.sh
│   └── ...
└── logs/
    ├── opinionctl.log
    └── console.log
```

## 后续计划

- Phase 3：镜像管理、前端发布与数据库迁移
- Phase 4：版本检查、一键升级与回滚
- Phase 5：备份、恢复与定时任务
- Phase 6：健康诊断、自动修复与分级卸载
