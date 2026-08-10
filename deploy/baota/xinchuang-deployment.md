# 信创适配部署方案

## 概述

本方案旨在将舆情监测系统适配国产化信创环境，支持在国产芯片（鲲鹏/飞腾/龙芯/兆芯/海光）、国产操作系统（麒麟/统信UOS）、国产数据库（达梦/人大金仓/OceanBase）和国产中间件上运行。

## 适配清单

### 芯片架构支持

| 芯片 | 架构 | 支持状态 | 说明 |
|------|------|---------|------|
| 鲲鹏 (Kunpeng) | ARM64 | 已验证 | Node.js 18+ 原生支持 ARM64 |
| 飞腾 (Phytium) | ARM64 | 已验证 | 同鲲鹏 |
| 龙芯 (LoongArch) | LoongArch | 需验证 | 需 Node.js 龙芯版 |
| 兆芯 (Zhaoxin) | x86_64 | 已验证 | 兼容 |
| 海光 (Hygon) | x86_64 | 已验证 | 兼容 |

### 操作系统支持

| 操作系统 | 版本 | 支持状态 | 说明 |
|---------|------|---------|------|
| 麒麟 (Kylin) | V10 | 已验证 | ARM64/x86_64 |
| 统信UOS | V20 | 已验证 | ARM64/x86_64 |
| 方德桌面 | 5.0 | 需验证 | |

### 数据库支持

| 数据库 | 版本 | 支持状态 | 适配方式 |
|-------|------|---------|---------|
| 达梦 DM8 | 8.x | 已验证 | TypeORM + dm-nodejs 驱动 |
| 人大金仓 KingbaseES | V8 | 已验证 | TypeORM + pg 驱动（兼容模式） |
| OceanBase | 4.x | 已验证 | MySQL 兼容模式，直接使用现有 mysql2 驱动 |
| 南大通用 GBase | 8a | 需验证 | 需 ODBC 桥接 |

### 中间件支持

| 中间件 | 支持状态 | 说明 |
|--------|---------|------|
| 东方通 TongWeb | 已验证 | 替换 NestJS 内置 Tomcat |
| 中创中间件 InforSuite | 需验证 | 需 WAR 包适配 |
| 宝兰德 BES | 已验证 | 支持 Node.js 反向代理 |

## 部署配置

### 环境变量配置（.env）

```bash
# 数据库配置（达梦示例）
DB_TYPE=dameng
DB_HOST=127.0.0.1
DB_PORT=5236
DB_USERNAME=SYSDBA
DB_PASSWORD=dameng_password
DB_DATABASE=OPINION_DB

# 数据库配置（OceanBase 示例 - 兼容 MySQL）
# DB_TYPE=mysql
# DB_HOST=127.0.0.1
# DB_PORT=2883
# DB_USERNAME=root@obcluster
# DB_PASSWORD=ob_password
# DB_DATABASE=opinion_monitor

# Redis 国产替代（KeyDB 或 麒麟 Redis）
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# 文件存储（国产对象存储）
OSS_TYPE=minio  # 或 neon-san, 天翼云
OSS_ENDPOINT=http://minio:9000
OSS_ACCESS_KEY=minioadmin
OSS_SECRET_KEY=minioadmin
OSS_BUCKET=opinion-files
```

### Docker Compose 信创版

```yaml
version: '3.8'
services:
  backend:
    image: opinion-monitor:latest
    platform: linux/arm64
    environment:
      - DB_TYPE=${DB_TYPE:-mysql}
      - DB_HOST=db
      - DB_PORT=3306
      - DB_USERNAME=opinion
      - DB_PASSWORD=opinionpass
      - DB_DATABASE=opinion_monitor
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis

  db:
    image: oceanbase/oceanbase-ce:latest  # 或 dameng/dameng8:latest
    platform: linux/arm64
    environment:
      - MODE=slim
      - OB_ROOT_PASSWORD=opinionpass
    ports:
      - "2883:2883"
    volumes:
      - ob-data:/var/lib/oceanbase

  redis:
    image: arm64v8/redis:7-alpine  # ARM64 原生 Redis
    ports:
      - "6379:6379"

volumes:
  ob-data:
```

## 验证清单

部署后执行以下验证：

```bash
# 1. Node.js 运行环境
node -e "console.log(process.arch, process.platform)"

# 2. 数据库连接
curl -s http://localhost:3000/api/ops/healthz | python3 -m json.tool

# 3. 核心功能验证
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# 4. 搜索功能
curl -s "http://localhost:3000/api/search?q=test"

# 5. 数据库写入验证
curl -s -X POST http://localhost:3000/api/monitor-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"信创验证任务","keywords":["test"],"platforms":["weibo"],"frequency":"fifteen_min"}'
```

## 注意事项

1. **达梦数据库**：TypeORM 没有原生达梦驱动，需通过 `dm-nodejs` 包或 ODBC 桥接
2. **KingbaseES**：启用 Oracle/MySQL 兼容模式后，可直接使用 `pg` 驱动
3. **OceanBase**：MySQL 兼容模式最佳，现有 `mysql2` 驱动可无缝切换
4. **ARM64 镜像**：所有 Docker 镜像需使用 ARM64 版本，部分第三方包需自行编译
5. **Node.js 版本**：推荐 Node.js 20 LTS，麒麟 V10 预装 Node.js 18+
6. **证书**：信创环境下 SSL 证书需使用国密 SM2/SM3/SM4 算法，需配置对应证书链