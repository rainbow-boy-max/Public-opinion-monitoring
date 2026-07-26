# 前端配置管理页面实现指南

## 文件位置

`frontend-admin/src/views/short-video-config/index.vue`

## 页面结构

### 两个主 Tab

1. **平台配置 Tab**
   - 抖音开放平台
   - 快手开放平台
   - 微信视频号
   - 哔哩哔哩

2. **阿里云配置 Tab**
   - Access Key 配置
   - OSS 存储配置
   - 视频 OCR 配置
   - 语音识别配置

## 核心功能

### API 调用

```typescript
// 获取所有平台配置
GET /admin/short-video-config/platforms

// 更新平台配置
PUT /admin/short-video-config/platforms/:platform

// 测试平台连接
POST /admin/short-video-config/platforms/:platform/test

// 获取阿里云配置
GET /admin/short-video-config/aliyun

// 更新阿里云配置
PUT /admin/short-video-config/aliyun

// 测试阿里云连接
POST /admin/short-video-config/aliyun/test
```

### 路由配置

在 `frontend-admin/src/router/index.ts` 中添加：

```typescript
{
  path: '/short-video-config',
  name: 'ShortVideoConfig',
  component: () => import('@/views/short-video-config/index.vue'),
  meta: {
    title: '短视频平台配置',
    roles: ['admin'],
    icon: 'VideoCamera'
  }
}
```

### 菜单配置

在管理端左侧菜单中添加「短视频平台配置」入口，位于「系统设置」分组。

## 前端完整代码

代码已在前面生成（见上文 VUE_EOF 部分），包含：
- 完整的表单字段
- 数据加载与保存逻辑
- 连接测试功能
- Element Plus 组件使用

## 技术债务已完成清单

✅ 后端配置实体（ShortVideoConfigEntity、AliyunVideoConfigEntity）
✅ 后端配置服务（ShortVideoConfigService）
✅ 后端配置控制器（ShortVideoConfigController）
✅ 后端 DTO 验证（UpdatePlatformConfigDto、UpdateAliyunConfigDto）
✅ 注册到 AppModule 和 data-source.ts
✅ 类型检查通过
✅ 前端页面代码（待集成）

## 下一步

1. 将前端代码文件放入 frontend-admin 项目
2. 配置路由和菜单
3. 测试配置保存与读取
4. 开始 Phase 8 实现

---

**文档版本**：v1.0  
**更新日期**：2026-07-22
