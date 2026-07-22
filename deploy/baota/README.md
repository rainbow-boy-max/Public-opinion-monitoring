# 宝塔部署包

本目录提供全网舆情监测系统在宝塔面板上的部署基础能力。

## Phase 1 已交付

- `install.sh`：环境预检、运行目录创建与安全配置生成
- `scripts/preflight.sh`：Docker、Docker Compose、宝塔 Nginx、端口、磁盘与内存检查
- `scripts/generate-env.sh`：生成 MySQL、Redis、JWT 与 AES 密钥配置
- `compose/docker-compose.yml`：MySQL、Redis、后端运行时编排
- `nginx/opinion-monitor.conf.template`：宝塔 Nginx 站点代理模板
- `manifest.json`：安装包元数据

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
