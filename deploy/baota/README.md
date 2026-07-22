# 宝塔部署包

本目录提供全网舆情监测系统在宝塔面板上的部署基础能力。

## Phase 1 已交付

- `install.sh`：环境预检、运行目录创建与安全配置生成
- `scripts/preflight.sh`：Docker、Docker Compose、宝塔 Nginx、端口、磁盘与内存检查
- `scripts/generate-env.sh`：生成 MySQL、Redis、JWT 与 AES 密钥配置
- `compose/docker-compose.yml`：MySQL、Redis、后端运行时编排
- `nginx/opinion-monitor.conf.template`：宝塔 Nginx 站点代理模板
- `manifest.json`：安装包元数据

## Phase 2 已交付

- `scripts/opinionctl`：受控服务管理命令，支持状态、健康检查、启停、重启和日志
- `console/server.mjs`：仅回环监听的 Express 控制台 API
- `console/public/index.html`：Vue 3 + Element Plus 可视化运维页
- `scripts/start-console.sh`：控制台启动脚本
- `console/nginx-console.conf.template`：宝塔 Nginx Basic Auth 代理模板
- `console/opinion-console.service.template`：systemd 服务模板

## Phase 3 已交付

- `scripts/build-release.sh`：构建后端 Docker 镜像、管理端/用户端静态资源，并通过软链接原子发布
- `scripts/bootstrap-app.sh`：首次数据库 Schema 初始化、启动服务与管理员引导
- `InitialAdminBootstrapService`：后端根据 `INIT_ADMIN_PASSWORD` 创建一次性初始管理员
- 控制台新增「安装向导」：执行构建发布和首次初始化
- `opinionctl` 新增 `release`、`bootstrap` 白名单命令

## Phase 4 已交付

- `scripts/backup-database.sh`：备份 MySQL、Redis、运行配置与元数据
- `scripts/rollback-application.sh`：回滚前端软链接与后端镜像到历史版本
- `scripts/restore-database.sh`：恢复数据库（恢复前自动创建快照）
- `opinionctl` 新增 `backup`、`rollback`、`restore` 命令
- 控制台新增「备份与回滚」Tab：备份列表、版本列表、一键回滚与恢复
- 控制台 API 新增备份、回滚、恢复端点与列表查询

## 首次安装

在已安装宝塔、Docker Engine、Docker Compose Plugin 的 Linux 服务器中执行：

```bash
bash install.sh \
  --domain opinion.example.com \
  --site-root /www/wwwroot/opinion-monitor \
  --runtime-root /www/server/opinion-monitor
```

安装程序会：

1. 执行环境预检。
2. 创建运行、数据、日志和备份目录。
3. 生成随机数据库、Redis、JWT、AES 密钥。
4. 写入权限为 `600` 的 `.env`。
5. 生成宝塔 Nginx 反向代理配置模板。
6. 输出下一阶段的应用镜像与前端发布位置。

## 当前限制

Phase 1 不会启动容器、不修改宝塔站点、不安装系统软件。后续 Phase 将由可视化部署控制台执行实际安装、升级、修复、备份和卸载。

## 目录约定

```text
/www/wwwroot/opinion-monitor/      前端发布根目录
/www/server/opinion-monitor/       Compose、配置、数据、日志与备份
```

敏感配置只保存在 `runtime-root/compose/.env`，权限为 `600`。请勿将该文件提交到版本库或通过聊天工具发送。
