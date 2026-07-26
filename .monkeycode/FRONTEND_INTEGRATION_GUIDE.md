# 前端集成完整指南

## 一、短视频配置管理前端集成

### 1. 文件已创建

✅ `/workspace/frontend-admin/src/views/short-video-config/index.vue`

### 2. 路由配置

在 `frontend-admin/src/router/index.ts` 中添加路由：

```typescript
{
  path: '/system',
  component: Layout,
  meta: { title: '系统管理', icon: 'Setting' },
  children: [
    // ... 其他路由
    {
      path: 'short-video-config',
      name: 'ShortVideoConfig',
      component: () => import('@/views/short-video-config/index.vue'),
      meta: {
        title: '短视频平台配置',
        roles: ['admin'],
        icon: 'VideoCamera'
      }
    }
  ]
}
```

### 3. 菜单配置

如果使用独立的菜单配置文件，确保添加：

```typescript
{
  path: '/system/short-video-config',
  title: '短视频平台配置',
  icon: 'VideoCamera',
  roles: ['admin']
}
```

### 4. API 工具检查

确认 `frontend-admin/src/utils/request.ts` 已正确配置：

```typescript
import axios from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 10000
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// 响应拦截器
service.interceptors.response.use(
  response => response.data,
  error => {
    ElMessage.error(error.response?.data?.message || '请求失败')
    return Promise.reject(error)
  }
)

export default service
```

### 5. 测试步骤

1. **启动后端**
```bash
cd /workspace/backend
npm run start:dev
```

2. **启动前端**
```bash
cd /workspace/frontend-admin
npm run dev
```

3. **访问页面**
   - 登录管理端
   - 进入「系统管理」→「短视频平台配置」
   - 测试配置保存和连接测试功能

---

## 二、API 对接验证清单

### 平台配置 API

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/admin/short-video-config/platforms` | GET | 获取所有平台配置 | ✅ |
| `/admin/short-video-config/platforms/:platform` | PUT | 更新平台配置 | ✅ |
| `/admin/short-video-config/platforms/:platform/test` | POST | 测试平台连接 | ✅ |

### 阿里云配置 API

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/admin/short-video-config/aliyun` | GET | 获取阿里云配置 | ✅ |
| `/admin/short-video-config/aliyun` | PUT | 更新阿里云配置 | ✅ |
| `/admin/short-video-config/aliyun/test` | POST | 测试阿里云连接 | ✅ |

### 验证方法

使用 curl 或 Postman 测试：

```bash
# 获取平台配置
curl -X GET http://localhost:3000/admin/short-video-config/platforms \
  -H "Authorization: Bearer YOUR_TOKEN"

# 更新抖音配置
curl -X PUT http://localhost:3000/admin/short-video-config/platforms/douyin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "test-key",
    "appSecret": "test-secret",
    "apiBaseUrl": "https://open.douyin.com",
    "isEnabled": true,
    "remark": "测试配置"
  }'

# 测试连接
curl -X POST http://localhost:3000/admin/short-video-config/platforms/douyin/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 三、Phase 8 准备工作

### 已完成

✅ Phase 8 完整实施方案文档  
✅ 报告生成数据模型设计  
✅ 报告生成服务代码（完整）  
✅ Word/PDF 导出方案  
✅ 前端页面设计  

### 下一步实施顺序

#### 第 1 步：创建报告生成实体（0.5 天）

文件：`backend/src/database/entities/report-generation.entity.ts`

代码已在 `PHASE8_COMPLETE_IMPLEMENTATION.md` 中提供。

#### 第 2 步：创建报告生成模块（2 天）

- `backend/src/modules/report-generation/report-generation.module.ts`
- `backend/src/modules/report-generation/report-generation.service.ts`
- `backend/src/modules/report-generation/report-generation.controller.ts`

#### 第 3 步：实现 Word/PDF 导出（1.5 天）

安装依赖：
```bash
npm install docx puppeteer marked
```

- `backend/src/modules/report-generation/exporters/word-exporter.ts`
- `backend/src/modules/report-generation/exporters/pdf-exporter.ts`

#### 第 4 步：实现前端报告页面（3 天）

- `frontend-admin/src/views/reports/index.vue`（列表）
- `frontend-admin/src/views/reports/create.vue`（创建向导）
- `frontend-admin/src/views/reports/detail.vue`（详情）

#### 第 5 步：测试与优化（1 天）

- 端到端测试
- 性能优化
- 文档更新

---

## 四、环境变量配置

### 前端环境变量

`frontend-admin/.env.development`

```env
VITE_APP_BASE_API=http://localhost:3000
VITE_APP_TITLE=全网舆情监测系统
```

### 后端环境变量

`backend/.env`

```env
# 数据库配置
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-password
DB_DATABASE=opinion_monitor

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 配置
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# 短视频配置（用户通过管理端填写，这里仅供参考）
ENABLE_REAL_API=false
```

---

## 五、常见问题

### Q1: 前端页面空白或报错

**检查**：
1. 路由是否正确配置
2. 组件导入路径是否正确
3. 浏览器控制台是否有错误
4. API 请求是否成功

### Q2: API 请求 401 未授权

**检查**：
1. Token 是否正确传递
2. 用户是否有 admin 权限
3. JWT Secret 是否配置正确

### Q3: 配置保存后刷新页面丢失

**原因**：后端数据库未正确保存

**解决**：
1. 检查数据库连接
2. 确认实体已注册到 data-source.ts
3. 运行数据库迁移

### Q4: 测试连接总是返回 Mock

**原因**：`ENABLE_REAL_API=false`

**解决**：填入真实 API 密钥后，可以实现真实连接测试

---

## 六、总结

### 当前状态

✅ **后端配置管理**：完整实现（实体、服务、控制器、DTO）  
✅ **前端配置页面**：完整实现（Vue 组件）  
⏳ **路由配置**：待集成  
⏳ **菜单配置**：待集成  
⏳ **API 对接测试**：待验证  

### 预计完成时间

- 路由和菜单配置：0.5 天
- API 对接测试：0.5 天
- **总计**：1 天

### 完成后即可启动 Phase 8

Phase 8 完整代码已在 `PHASE8_COMPLETE_IMPLEMENTATION.md` 中提供，可直接实施。

---

**文档版本**：v1.0  
**更新日期**：2026-07-22  
**负责人**：开发团队
