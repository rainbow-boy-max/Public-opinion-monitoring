# 舆情监测系统 — 一键部署

## 前置条件

- Docker 24.0+
- Docker Compose 2.20+
- 4GB+ 可用内存
- 20GB+ 可用磁盘

## 部署步骤

### 1. 克隆项目

```bash
git clone <repo-url> opinion-monitor
cd opinion-monitor
```

### 2. 配置环境变量（可选）

```bash
# 默认值可直接使用，生产环境建议修改
export JWT_SECRET=$(openssl rand -hex 32)
export INIT_ADMIN_PASSWORD=your-password
export DB_PASSWORD=your-db-password
```

### 3. 一键启动

```bash
docker compose up -d
```

### 4. 执行数据库迁移

```bash
# 等待后端启动后，进入后端容器执行迁移
docker exec opinion-backend npx typeorm migration:run -d dist/database/data-source.js
```

### 5. 访问系统

- 管理端: http://localhost:80
- 用户端: http://localhost:81
- 默认账号: admin / 123456（首次登录强制改密）

## 服务管理

```bash
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f backend

# 重启
docker compose restart backend

# 停止
docker compose down

# 完全清理（删除数据卷）
docker compose down -v
```

## 生产环境建议

1. 修改 `.env` 中的 `JWT_SECRET`、`DB_PASSWORD`、`INIT_ADMIN_PASSWORD`
2. 配置 HTTPS（使用反向代理如 Nginx + Let's Encrypt）
3. 设置 `DB_SYNC=false`，使用 migration 管理 schema
4. 配置外部 Redis 和 MySQL 以提高性能
5. 启用 ES 全文检索：设置 `ES_NODE=http://elasticsearch:9200`
6. 定期备份 MySQL 数据卷