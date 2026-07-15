# 5 项问题整改方案

## 问题 1：工单提交支持附件上传

**需求**：提交工单时允许上传图片、视频、文档、txt 等通用文件类型。

**方案**：
- 后端：新增 `FileController` 处理文件上传（`POST /api/upload`）
- 后端：`work-order.entity.ts` 新增 `attachments` JSON 字段存储附件列表
- 后端：`WorkOrderController` 新增 `POST /work-orders/with-files` 支持 multipart 上传
- 前端：`WorkOrdersPage.vue` 提交对话框增加 `<el-upload>` 组件
  - 限制文件类型：jpg/png/gif/mp4/avi/pdf/doc/docx/xls/xlsx/txt
  - 最大文件数：5 个
  - 最大单个文件：20MB
- 文件存储路径：`/data/uploads/` 目录
- 工单详情中展示附件列表，可点击下载/预览

## 问题 2：管理端工单功能不完整

**根因**：管理端 `WorkOrdersPage.vue` 已有回复/完结功能，但缺少"提交工单"和"评分推送"。

**方案**：

| 功能 | 当前 | 修复后 |
|------|------|--------|
| 提交工单 | ❌ | 新增"创建工单"按钮，从管理端直接创建 |
| 回复工单 | ✅ | 保持不变 |
| 完结工单 | ✅ | 保持不变 |
| 分配处理人 | ✅ | 保持不变 |
| 评分推送 | ❌ | 工单完结后自动推送评分通知给用户 |

## 问题 3：知识图谱显示使用的 LLM

**需求**：用户端和管理端的知识图谱页面显示正在使用的 LLM 模型名称。

**方案**：
- 后端：`GET /api/knowledge-graph/active-model` 返回当前启用的 LLM 模型信息
  ```json
  { "name": "DeepSeek-V3", "provider": "deepseek", "isEnabled": true }
  ```
- 后端：`knowledge-graph.service.ts` 注入 `LlmModelsService` 获取已启用模型
- 前端：知识图谱页面左上角增加"当前模型"标签（绿色 tag），显示模型名称
- 无模型时显示"未配置"灰色标签

## 问题 4：AI 公关无反应

**根因**：`PrReportsPage.vue` 首次加载时 `reports` 列表为空，页面显示空白状态，用户以为没反应。上次修复添加了"加载示例报告"按钮，但可能未正确渲染。

**修复确认**：
- 确认空状态的 `v-if="!loading && reports.length === 0"` 条件正确
- 确保 `loadReports()` 在 `onMounted` 中被正确调用
- 检查控制台是否有 JS 错误
- 确认"加载示例报告"按钮的 click 事件绑定正确

## 问题 5：热点话题全面升级

### 5a. Mock 数据清洁
- 删除平台热点 mock 数据中的无关话题（如"冬季皮肤保养"等季节性内容）
- 替换为当前真实热点话题（科技、娱乐、社会、体育等）

### 5b. 实时状态与时间戳
- 页面顶部显示"最后更新：刚刚/XX分钟前"
- 自动刷新倒计时（60s 刷新一次）
- 每条话题显示发布时间和热度变化趋势

### 5c. 管理端热点话题配置页
新增 `/workspace/frontend-admin/src/pages/HotTopicsConfigPage.vue`：

| 配置项 | 说明 |
|--------|------|
| 数据源选择 | 微博/抖音/百度/知乎/小红书，可多选 |
| 自动刷新 | 开启/关闭，刷新间隔（30s/60s/5min） |
| 话题过滤 | 关键词白名单/黑名单 |
| 缓存时间 | 数据缓存时长（1min/5min/15min） |
| 接入方式 | 使用 `https://60s.viki.moe/v2/` 免费聚合 API（无需 Key）|
| | 或配置自有 API Key（微博开放平台/百度开放平台等） |

### 5d. 平台热点接入方式
使用 `https://60s.viki.moe/v2/` 聚合 API（开源免费项目 `vikiboss/60s`），支持：

| 平台 | Endpoint |
|------|----------|
| 微博热搜 | `https://60s.viki.moe/v2/weibo` |
| 知乎热榜 | `https://60s.viki.moe/v2/zhihu` |
| 百度热搜 | `https://60s.viki.moe/v2/baidu/hot` |
| 抖音热点 | `https://60s.viki.moe/v2/douyin` |
| B站热门 | `https://60s.viki.moe/v2/bili` |

后端新增 `PlatformHotSourceService` 从该 API 实时获取数据，前端展示统一格式。

---

## 改动清单

| 文件 | 改动 |
|------|------|
| `backend/.../work-order.entity.ts` | 新增 `attachments` 字段 |
| `backend/.../work-orders.controller.ts` | 新增文件上传路由 |
| `backend/.../upload.controller.ts` | 新建文件上传控制器 |
| `backend/.../knowledge-graph.service.ts` | 注入 LLM 模型查询 |
| `backend/.../knowledge-graph.controller.ts` | 新增 `active-model` 端点 |
| `backend/.../platform-hot.service.ts` | 改用实时 API + 缓存 |
| `backend/.../hot-topics.controller.ts` | 新增配置端点 |
| `frontend-user/.../WorkOrdersPage.vue` | 添加上传组件 |
| `frontend-user/.../KnowledgeGraphPage.vue` | 显示 LLM 模型标签 |
| `frontend-user/.../PrReportsPage.vue` | 确认修复 |
| `frontend-user/.../HotTopicsPage.vue` | 实时状态 + 时间戳 |
| `frontend-admin/.../WorkOrdersPage.vue` | 新增创建+评分推送 |
| `frontend-admin/.../KnowledgeGraphPage.vue` | 显示 LLM 模型标签 |
| `frontend-admin/.../HotTopicsConfigPage.vue` | 新建配置页面 |

---

确认后开始实施。
