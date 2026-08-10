# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[推送前同步更新 README 变更日志]
- Date: 2026-07-18
- Context: 用户要求每次修复后推送到 GitHub 时同步更新仓库 README
- Instructions:
  - 每次修复/功能改动并推送到 GitHub 时，必须同步修改仓库根目录 `README.md`
  - 在「更新日志」章节追加本次改动说明（日期 + 变更要点，日志风格）
  - 同步更新 README 底部「最后更新」日期
  - 提交时把 README 与代码改动一并 commit 后再 push

[登录和全功能排障：JWT guard 与缺失表]
- Date: 2026-08-02
- Context: Agent 修复管理端/用户端无法登录和"服务器异常"
- Category: 排错调试
- Instructions:
  - `JwtAuthGuard` 的 `JwtService` 不能直接构造注入（各模块未导入 `JwtModule`，会报 "Nest can't resolve dependencies"）；已改为通过 `ModuleRef` 的 `moduleRef.get(JwtService, { strict: false })` 懒加载
  - `DB_SYNCHRONIZE=false` 时，新增实体表/列不会自动创建；migrations 表也不存在时，需手工执行 CREATE TABLE 补全
  - MariaDB 不支持 TypeORM `synchronize=true` 生成的 `enum(...)` 语法，开启同步会报 "You have an error in your SQL syntax"，只能用迁移或手写 SQL 的 varchar 代替
  - 前后端接口路径前缀需一致：部分 controller 用 `admin/*`、`dashboards`（非 `dashboard`）等前缀，404 多为路由不匹配，非服务异常
  - 后端 `nest start --watch` 若报 `Cannot find module 'openai'` 等，多为增量编译缓存问题，需 `rm -rf dist node_modules/.cache` 后重启
