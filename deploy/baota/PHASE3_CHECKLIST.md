# Phase 3 验收清单

## 已交付文件

| 文件                                             | 功能                              | 状态 |
| ------------------------------------------------ | --------------------------------- | ---- |
| `scripts/build-release.sh`                       | 后端镜像构建、前端构建与原子发布  | ✅   |
| `scripts/bootstrap-app.sh`                       | 首次数据库初始化与后端启动        | ✅   |
| `scripts/opinionctl`                             | 新增 `release` / `bootstrap` 命令 | ✅   |
| `console/server.mjs`                             | 新增发布、初始化 API              | ✅   |
| `console/public/index.html`                      | 新增安装向导页面                  | ✅   |
| `backend/src/initial-admin-bootstrap.service.ts` | 初始管理员安全创建服务            | ✅   |

## 构建发布流程

1. 用户输入可选版本号；空值时使用时间戳。
2. 使用 `docker build` 构建后端镜像：`opinion-monitor/backend:<version>`。
3. 执行管理端与用户端 `pnpm run build`。
4. 发布静态资源到：

```text
/www/wwwroot/opinion-monitor/releases/<version>/admin
/www/wwwroot/opinion-monitor/releases/<version>/user
```

5. 使用软链接原子切换：

```text
/www/wwwroot/opinion-monitor/current -> releases/<version>
```

6. 将镜像标签写入 `compose/.env`：

```env
BACKEND_IMAGE=opinion-monitor/backend:<version>
APP_VERSION=<version>
```

7. 保存 `release.json`，记录版本、镜像与构建时间。

## 首次初始化流程

1. 使用临时 `.env` 设置 `DB_SYNCHRONIZE=true`。
2. 启动 MySQL、Redis 和后端服务。
3. 后端 `InitialAdminBootstrapService` 检查 `INIT_ADMIN_PASSWORD`。
4. 若不存在 `admin` 用户，使用 bcrypt 哈希创建管理员。
5. 初始管理员 `firstLogin=1`，首次登录强制修改密码。
6. 若管理员已存在，服务不会修改现有密码。

## 控制台操作

### 构建并发布

在「安装向导」页面输入版本号，点击「构建并发布」。

等价命令：

```bash
opinionctl release 20260722001
```

### 首次初始化

在「安装向导」页面点击「执行初始化」。

等价命令：

```bash
opinionctl bootstrap
```

## 验证结果

- ✅ `build-release.sh` Shell 语法检查通过
- ✅ `bootstrap-app.sh` Shell 语法检查通过
- ✅ `opinionctl` Shell 语法检查通过
- ✅ 控制台 Node API 语法检查通过
- ✅ 后端完整 TypeScript typecheck 通过

## 安全说明

- 后端镜像仅绑定 `127.0.0.1:3000`。
- MySQL 与 Redis 不映射宿主机公网端口。
- 初始管理员密码来自权限 `600` 的 `.env`。
- 管理员存在时不覆盖密码。
- 前端发布通过软链接原子切换，保留历史版本用于 Phase 4 回滚。

## Phase 3 限制

- 当前 Schema 初始化使用 TypeORM `DB_SYNCHRONIZE=true`，仅适用于首次空数据库。
- 生产升级中的可逆迁移、数据库备份和自动回滚将在 Phase 4 实现。
- 前端构建依赖部署服务器中的 pnpm 和项目源码目录。

## 后续 Phase 4

- 版本清单和更新检查
- 自动升级前备份
- 前端软链接回滚
- 后端镜像回滚
- 数据库快照与恢复入口
