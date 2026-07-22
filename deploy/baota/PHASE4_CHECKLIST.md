# Phase 4 验收清单

## 已交付文件

| 文件 | 功能 | 状态 |
|------|------|------|
| `scripts/backup-database.sh` | MySQL、Redis、配置备份 | ✅ |
| `scripts/rollback-application.sh` | 前端软链接 + 后端镜像回滚 | ✅ |
| `scripts/restore-database.sh` | 数据库恢复（恢复前自动快照） | ✅ |
| `scripts/opinionctl` | 新增 `backup`、`rollback`、`restore` 命令 | ✅ |
| `console/server.mjs` | 新增备份、回滚、恢复、列表查询 API | ✅ |
| `console/public/index.html` | 新增「备份与回滚」Tab | ✅ |

## 备份机制

### 备份内容

- MySQL 逻辑备份：`mysqldump` 单事务导出，gzip 压缩
- Redis 快照：`BGSAVE` 触发持久化，复制 `dump.rdb`
- 运行时配置：`.env` 文件备份（权限 600）
- 备份元数据：`metadata.json` 记录备份 ID、创建时间、数据库名、镜像版本

### 备份存储

```text
/www/server/opinion-monitor/backups/<备份ID>/
├── database.sql.gz
├── redis.rdb
├── compose.env
└── metadata.json
```

### 备份命令

```bash
opinionctl backup                    # 自动生成备份ID
opinionctl backup 20260722120000     # 指定备份ID
```

## 回滚机制

### 回滚范围

- 前端：软链接 `current` 原子切换到历史 `releases/<version>`
- 后端：更新 `.env` 中的 `BACKEND_IMAGE` 并重启容器
- 数据库：**不回滚**，保留当前数据

### 版本列表

控制台自动读取 `releases/` 目录下的版本元数据，展示：

- 版本号
- 创建时间
- 后端镜像标签

### 回滚命令

```bash
opinionctl rollback 20260722001
```

## 恢复机制

### 恢复前保护

恢复数据库前，自动创建当前数据库快照：

```text
backups/pre-restore-<时间戳>/
```

### 恢复内容

- MySQL 数据库：使用 `mysql` 命令导入 gzip 压缩的 SQL
- Redis 快照：停止 Redis，替换 `dump.rdb`，重启服务
- 运行时配置：**不自动覆盖**（需手动确认）

### 恢复命令

```bash
opinionctl restore 20260722120000
```

## 控制台操作

### 备份管理

在「备份与回滚」Tab：

1. 点击「立即备份」执行备份
2. 点击「刷新列表」查看所有备份
3. 备份列表展示备份 ID、创建时间、数据库名
4. 每个备份可点击「恢复」按钮

### 版本回滚

在「备份与回滚」Tab：

1. 点击「刷新版本列表」查看所有历史版本
2. 版本列表展示版本号、创建时间、后端镜像
3. 点击「回滚」按钮并确认
4. 回滚成功后自动刷新服务健康状态

### 操作确认

- 回滚操作：弹窗确认，提示会重启后端但保留数据库
- 恢复操作：弹窗确认，提示会自动创建恢复前快照

## 验证结果

- ✅ `backup-database.sh` Shell 语法检查通过
- ✅ `rollback-application.sh` Shell 语法检查通过
- ✅ `restore-database.sh` Shell 语法检查通过
- ✅ `opinionctl` Shell 语法检查通过
- ✅ 控制台 Node API 语法检查通过
- ✅ 控制台前端格式化通过

## 安全说明

- 备份文件存储在 `backups/` 目录，不会自动清理
- 恢复前自动创建快照，避免误操作导致数据丢失
- 备份 `.env` 时保持权限 600
- 回滚操作不会删除当前版本，仅切换软链接
- 数据库恢复需显式确认，防止误触

## Phase 4 限制

- 备份不包含上传文件目录（`data/uploads/`）
- 不支持自动定时备份（需 Phase 5 或宝塔计划任务）
- 不支持远程备份存储
- 回滚不包含数据库，需要单独恢复
- 版本列表和备份列表无分页，大量历史版本时可能加载较慢

## 后续 Phase 5

- 定时备份任务
- 备份自动清理与保留策略
- 远程备份存储（OSS/S3）
- 完整升级流程（备份 → 升级 → 验证 → 回滚）
- 健康诊断与自动修复
- 分级卸载与数据销毁
