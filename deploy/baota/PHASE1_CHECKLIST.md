# Phase 1 验收清单

## 已交付文件

| 文件 | 功能 | 状态 |
|------|------|------|
| `README.md` | 部署包说明与使用文档 | ✅ |
| `install.sh` | 主安装脚本 | ✅ |
| `scripts/preflight.sh` | 环境预检 | ✅ |
| `scripts/generate-env.sh` | 安全配置生成 | ✅ |
| `compose/docker-compose.yml` | MySQL、Redis、后端编排 | ✅ |
| `nginx/opinion-monitor.conf.template` | 宝塔 Nginx 代理模板 | ✅ |
| `manifest.json` | 安装包元数据 | ✅ |

## 脚本语法验证

- ✅ `install.sh` 语法检查通过
- ✅ `preflight.sh` 语法检查通过
- ✅ `generate-env.sh` 语法检查通过

## 安全设计

- ✅ `.env` 文件权限强制为 `600`
- ✅ 自动生成 32 字符随机 MySQL 密码
- ✅ 自动生成 32 字符随机 Redis 密码
- ✅ 自动生成 48 字符随机 JWT Secret
- ✅ 自动生成 32 字节 base64 AES-256-CBC 密钥
- ✅ 自动生成 16 字符随机初始管理员密码
- ✅ 覆盖已有 `.env` 前自动备份

## 环境预检覆盖

- ✅ root 权限检查
- ✅ Linux 发行版识别（RHEL/Debian 系）
- ✅ Docker Engine 可用性与版本
- ✅ Docker Compose Plugin 可用性
- ✅ 宝塔面板与 Nginx 检测
- ✅ 端口占用检测（3000/3306/6379）
- ✅ 磁盘可用空间检查（最小 10GB）
- ✅ 系统内存检查（最小 2GB）

## 目录结构

```text
/www/wwwroot/opinion-monitor/
├── current/
├── releases/
└── backups/

/www/server/opinion-monitor/
├── compose/
│   ├── docker-compose.yml
│   └── .env (600)
├── data/
│   ├── mysql/
│   ├── redis/
│   └── uploads/
├── logs/
├── scripts/
│   ├── preflight.sh
│   └── generate-env.sh
├── nginx/
│   └── opinion-monitor.conf
├── backups/
└── INSTALL_SUMMARY.txt
```

## Docker Compose 设计

- ✅ MySQL 8.0.36 官方镜像
- ✅ Redis 7.2-alpine 官方镜像
- ✅ 后端镜像通过环境变量 `BACKEND_IMAGE` 配置
- ✅ MySQL、Redis 仅暴露 Docker 内部网络
- ✅ 后端绑定 `127.0.0.1:3000`，由宝塔 Nginx 转发
- ✅ 健康检查覆盖 MySQL、Redis、后端
- ✅ 数据持久化挂载独立目录，容器删除不丢失

## 宝塔 Nginx 配置

- ✅ 管理端 `/admin/` 静态资源与 SPA fallback
- ✅ 用户端 `/user/` 静态资源与 SPA fallback
- ✅ `/api/` 反向代理到后端
- ✅ `/socket.io/` WebSocket 反向代理（86400s 超时）
- ✅ 域名、站点根目录、后端端口通过模板变量配置

## 安装流程

```bash
cd /workspace/deploy/baota
bash install.sh --domain opinion.example.com
```

输出：

- ✅ 环境预检报告
- ✅ 运行目录创建日志
- ✅ 初始管理员账户（用户名 + 随机密码）
- ✅ 安装摘要文件 `INSTALL_SUMMARY.txt`

## Phase 1 限制

- ⚠️ 不会启动容器
- ⚠️ 不会创建宝塔站点
- ⚠️ 不会修改 Nginx 配置
- ⚠️ 不会拉取或构建镜像
- ⚠️ 不会发布前端静态资源
- ⚠️ 不会执行数据库迁移

## 下一阶段

Phase 2 将实现可视化部署控制台，支持：

- 应用安装（拉取镜像、发布前端、启动容器、执行迁移）
- 升级与回滚
- 健康检查与修复
- 备份与恢复
- 分级卸载
