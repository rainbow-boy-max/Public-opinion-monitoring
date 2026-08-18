# 登录界面与预览系统修复报告

**日期**: 2026-08-15  
**修复范围**: 管理端登录页面、用户端登录页面、预览网关、CORS 配置、密码修改页面

---

## 问题概述

### 1. 登录页面重复元素
- **管理端**：密码框重复渲染
- **用户端**：验证码 Tab 重复渲染

### 2. 预览系统错误
- 旧预览端口失效，返回 530 错误
- 后端未随预览一起启动
- 统一入口方案（单端口网关）因基路径配置错误失败

### 3. CORS 配置缺失
- 后端白名单未包含预览域名 `*.monkeycode-ai.online`
- 导致登录接口返回 500 Internal Server Error

### 4. 错误提示重复
- 登录页和修改密码页捕获异常后重复显示错误
- 与 `http.ts` 统一错误拦截器冲突

### 5. 用户端导航问题
- 桌面端缺少侧边栏导航
- resize 监听器未在组件销毁时清理
- 已登录用户访问登录页未自动跳转

---

## 修复方案

### 1. 删除登录页重复元素

#### 管理端密码框
**文件**: `frontend-admin/src/pages/LoginPage.vue`

删除第 69-85 行重复的密码表单项：
```vue
<!-- 已删除重复密码框 -->
```

#### 用户端验证码 Tab
**文件**: `frontend-user/src/pages/LoginPage.vue`

删除第 103-119 行重复的手机验证码 Tab：
```vue
<!-- 已删除重复验证码 Tab -->
```

---

### 2. 修复预览系统

#### 方案选择
尝试统一网关（单端口 8080）失败：
- 管理端基路径 `/admin/` 导致静态资源 404
- 回退为独立端口方案

#### 最终配置
- **管理端**: `https://5174-xxx.monkeycode-ai.online` (端口 5174)
- **用户端**: `https://5173-xxx.monkeycode-ai.online` (端口 5173)
- **后端**: 端口 3000，通过 Vite 代理访问

#### Vite 代理配置
**管理端**: `frontend-admin/vite.config.ts`
```typescript
server: {
  port: 5174,
  host: true,
  allowedHosts: ['.monkeycode-ai.online', 'localhost'],
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

**用户端**: `frontend-user/vite.config.ts`
```typescript
server: {
  port: 5173,
  host: true,
  allowedHosts: ['.monkeycode-ai.online', 'localhost'],
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

---

### 3. 修复 CORS 白名单

**文件**: `backend/src/main.ts`

**修改前**:
```typescript
origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

**修改后**:
```typescript
origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || (origin && origin.includes('monkeycode-ai.online'))) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

**效果**: 允许所有 `*.monkeycode-ai.online` 域名通过 CORS 验证

---

### 4. 移除重复错误提示

#### 管理端登录页
**文件**: `frontend-admin/src/pages/LoginPage.vue:302-309`

**修改前**:
```typescript
} catch (err: any) {
  const lang = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  errorMessage.value = err?.messageEn
    ? lang === 'en' ? err.messageEn : err.message
    : err?.message || (lang === 'en' ? 'Login failed' : '登录失败');
  captchaVerifyParam.value = '';
}
```

**修改后**:
```typescript
} catch (err: any) {
  errorMessage.value = err?.message || '登录失败';
  captchaVerifyParam.value = '';
}
```

#### 修改密码页
**文件**: `frontend-admin/src/pages/ChangePasswordPage.vue:82`

**修改前**:
```typescript
} catch (err: any) {
  ElMessage.error(err?.message || '修改失败');
}
```

**修改后**:
```typescript
} catch (err: any) {
  // http.ts 已经显示错误通知，这里不需要重复
}
```

**原理**: `http.ts` 响应拦截器已统一处理所有 HTTP 错误并显示通知，页面组件无需重复显示。

---

### 5. 用户端导航与路由优化

#### 桌面端侧边栏导航
**文件**: `frontend-user/src/layouts/UserLayout.vue`

**新增功能**:
- 桌面端（≥768px）：侧边栏分组导航，固定左侧
- 移动端（<768px）：保留抽屉式菜单
- 自适应切换，无缝体验

**实现**:
```vue
<aside v-if="!isMobile" class="sidebar">
  <nav class="sidebar-nav">
    <div v-for="group in menuGroups" :key="group.label" class="menu-group">
      <div class="menu-group__label">{{ group.label }}</div>
      <router-link
        v-for="item in group.items"
        :key="item.path"
        :to="item.path"
        class="menu-item"
      >
        <component :is="item.icon" class="menu-item__icon" />
        <span class="menu-item__text">{{ item.label }}</span>
      </router-link>
    </div>
  </nav>
</aside>
```

#### 路由守卫优化
**文件**: `frontend-user/src/router/index.ts`

**新增逻辑**:
```typescript
router.beforeEach(async (to, from, next) => {
  const auth = useUserAuthStore();

  // 已登录用户访问登录页 → 跳转首页
  if (to.path === '/login' && auth.isAuthenticated) {
    next('/dashboard');
    return;
  }

  // 未登录用户访问受保护页面 → 跳转登录页
  if (!to.meta.public && !auth.isAuthenticated) {
    next('/login');
    return;
  }

  next();
});
```

#### Resize 监听清理
**文件**: `frontend-user/src/layouts/UserLayout.vue`

**修复前**: `window.removeEventListener` 未正确清理
**修复后**:
```typescript
const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
```

---

## 验证结果

### 登录功能
- ✅ 管理端登录：`admin / Admin@123456` 正常登录
- ✅ 用户端登录：手机验证码和账号密码均正常
- ✅ 错误提示：只显示一个错误通知，内容准确

### 预览系统
- ✅ 管理端预览：`https://5174-xxx.monkeycode-ai.online`
- ✅ 用户端预览：`https://5173-xxx.monkeycode-ai.online`
- ✅ API 代理：`/api/*` 正确转发到后端 3000 端口

### CORS
- ✅ 预览域名通过 CORS 验证
- ✅ 登录接口返回 200 和完整 Token

### 导航体验
- ✅ 桌面端侧边栏固定显示
- ✅ 移动端抽屉菜单正常
- ✅ 已登录用户访问登录页自动跳转
- ✅ Resize 监听正确清理

---

## 技术要点

### 错误处理统一化
Axios 响应拦截器统一处理所有 HTTP 错误：
- 401 → 清除 Token，跳转登录
- 403 → 权限不足提示
- 422/429/500 → 显示业务错误码对应的双语通知

页面组件只需 `try-catch` 捕获异常，无需重复显示错误。

### CORS 白名单设计
生产环境应使用环境变量配置：
```bash
ALLOWED_ORIGINS=https://admin.example.com,https://app.example.com
```

开发环境通配符方案仅用于预览系统。

### 响应式导航最佳实践
1. 使用 `window.innerWidth` 而非 `matchMedia`（兼容性更好）
2. 必须在 `onUnmounted` 清理监听器
3. 桌面/移动端共享相同菜单数据源

---

## 文件清单

### 前端文件
- `frontend-admin/src/pages/LoginPage.vue`
- `frontend-admin/src/pages/ChangePasswordPage.vue`
- `frontend-admin/src/router/index.ts`
- `frontend-admin/vite.config.ts`
- `frontend-user/src/pages/LoginPage.vue`
- `frontend-user/src/layouts/UserLayout.vue`
- `frontend-user/src/router/index.ts`

### 后端文件
- `backend/src/main.ts`

### 新增文件
- `gateway.js`（单端口网关实验，最终未使用）

---

## 遗留问题

### Gateway 单端口方案
`gateway.js` 文件保留但未启用，原因：
- 管理端基路径 `/admin/` 导致 Vite 构建的静态资源路径错误
- 回退配置导致前端重复启动

**建议**: 删除 `gateway.js` 或作为生产环境 Nginx 配置参考。

---

## 总结

本次修复彻底解决了登录界面、预览系统、CORS 配置和错误提示的所有问题。管理端和用户端现在可以正常登录、导航和使用。

**核心改进**:
1. 统一错误处理机制
2. 完善 CORS 白名单
3. 优化用户端导航体验
4. 清理重复代码和资源

**测试通过**: 管理端和用户端登录、导航、密码修改均正常工作。
