<template>
  <el-container class="admin-layout">
    <el-aside :width="isCollapsed ? '64px' : '240px'" class="admin-aside" :class="{ 'admin-aside--collapsed': isCollapsed }">
      <div class="admin-aside__brand" v-show="!isCollapsed">
        <div class="admin-aside__logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stop-color="#5E72E4" />
                <stop offset="100%" stop-color="#7C3AED" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
            <path d="M8 20L14 12L18 16L24 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="24" cy="10" r="2" fill="white" />
          </svg>
        </div>
        <div class="admin-aside__title">
          <div class="admin-aside__title-main">舆情监测</div>
          <div class="admin-aside__title-sub">Super Admin</div>
        </div>
      </div>

      <nav class="admin-aside__nav">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          :class="{ 'menu-item--active': isMenuActive(item.path) }"
          @click="navigateTo(item.path)"
        >
          <span class="menu-item__icon" :innerHTML="item.icon" />
          <span class="menu-item__text" v-show="!isCollapsed">{{ item.label }}</span>
          <span v-if="item.badge" class="menu-item__badge" v-show="!isCollapsed">{{ item.badge }}</span>
        </div>
      </nav>

      <div class="admin-aside__footer" v-show="!isCollapsed">
        <div class="admin-aside__user-card">
          <div class="admin-aside__avatar">
            {{ (auth.user?.username || 'A').charAt(0).toUpperCase() }}
          </div>
          <div class="admin-aside__user-info">
            <div class="admin-aside__user-name">{{ auth.user?.username }}</div>
            <div class="admin-aside__user-role">超级管理员</div>
          </div>
        </div>
      </div>
    </el-aside>

    <el-main class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__left">
          <el-icon class="admin-topbar__toggle" @click="toggleCollapse">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
          <el-button class="mobile-menu-btn" :icon="Operation" @click="drawerVisible = true" />
          <PageHeader gradient :title="currentTitle" :subtitle="currentSubtitle" />
        </div>
        <div class="admin-topbar__right">
          <div class="admin-topbar__time">{{ currentTime }}</div>
          <el-dropdown @command="onCommand">
            <div class="admin-topbar__user">
              <span class="admin-topbar__user-text">设置</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <div class="admin-content fade-in">
        <router-view v-slot="{ Component }">
          <keep-alive :include="keepAliveIncludes">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </el-main>
  </el-container>

  <!-- 手机抽屉菜单（在 el-container 外部避免 flex 干扰） -->
  <el-drawer v-model="drawerVisible" :size="260" direction="ltr" :with-header="false">
    <template #default>
      <div class="admin-aside" style="width:100%;height:100%;position:static;border:none;background:var(--bg-cosmic);box-shadow:none;">
        <div class="admin-aside__brand">
          <div class="admin-aside__logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <defs><linearGradient id="dlgGrad" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stop-color="#5E72E4" /><stop offset="100%" stop-color="#7C3AED" /></linearGradient></defs>
              <rect width="32" height="32" rx="8" fill="url(#dlgGrad)" />
              <path d="M8 20L14 12L18 16L24 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <circle cx="24" cy="10" r="2" fill="white" />
            </svg>
          </div>
          <div class="admin-aside__title">
            <div class="admin-aside__title-main">舆情监测</div>
            <div class="admin-aside__title-sub">Super Admin</div>
          </div>
        </div>
        <nav class="admin-aside__nav">
          <div v-for="item in menuItems" :key="item.path" class="menu-item"
            :class="{ 'menu-item--active': isMenuActive(item.path) }"
            @click="navigateTo(item.path); drawerVisible = false">
            <span class="menu-item__icon" :innerHTML="item.icon" />
            <span class="menu-item__text">{{ item.label }}</span>
          </div>
        </nav>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminAuthStore } from '@/store/auth';
import { Expand, Fold, SwitchButton, Operation } from '@element-plus/icons-vue';
import PageHeader from '@shared/components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const auth = useAdminAuthStore();

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
}

const menuItems: MenuItem[] = [
  {
    path: '/dashboard',
    label: '概览',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  },
  {
    path: '/users',
    label: '用户管理',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  },
  {
    path: '/agents',
    label: 'AI 智能体',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>',
  },
  {
    path: '/llm-models',
    label: 'LLM 模型',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  },
  {
    path: '/knowledge',
    label: 'AI 知识库',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  },
  {
    path: '/config/aliyun-sms',
    label: '短信配置',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  },
  {
    path: '/sms-templates',
    label: '短信模板',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  },
  {
    path: '/config/aliyun-verify',
    label: '三要素认证',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
  },
  {
    path: '/config/web-search',
    label: 'Web 搜索',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  },
  {
    path: '/config/kb-scoring',
    label: 'AI 打分',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
  },
  {
    path: '/system-logs',
    label: '系统日志',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>',
  },
  {
    path: '/competitor-tracking',
    label: '竞品追踪',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
  },
  {
    path: '/hot-topics',
    label: '热点话题',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  },
  {
    path: '/alert',
    label: '预警中心',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  },
];

const currentTime = ref('');
let timer: number | undefined;
const isCollapsed = ref(false);

const META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: '概览', subtitle: '系统关键指标与状态' },
  '/users': { title: '用户管理', subtitle: '注册用户与权限控制' },
  '/agents': { title: 'AI 智能体', subtitle: '自定义 AI 智能体与知识库' },
  '/llm-models': { title: 'LLM 模型', subtitle: '管理 6 大厂商与自定义模型' },
  '/knowledge': { title: 'AI 知识库', subtitle: '独立知识库 · AI 解析 · AI 打分 · AI 增强' },
  '/config/aliyun-sms': { title: '短信配置', subtitle: '阿里云短信服务接入' },
  '/sms-templates': { title: '短信模板', subtitle: '7 大场景短信模板管理 + 一键报备' },
  '/config/aliyun-verify': { title: '三要素认证配置', subtitle: '阿里云手机号三要素详细版' },
  '/config/web-search': { title: 'Web 搜索配置', subtitle: 'AI 智能体联网搜索 Provider 与 Key' },
  '/config/kb-scoring': { title: 'AI 打分配置', subtitle: '知识库文档 AI 自动评分模型与能力设置' },
  '/system-logs': { title: '系统日志', subtitle: 'API 请求与异常记录' },
  '/alert': { title: '预警中心', subtitle: '预警规则与触发记录' },
  '/hot-topics': { title: '热点话题', subtitle: '上升热点发现与聚合管理' },
  '/competitor-tracking': { title: '竞品追踪', subtitle: '竞品动态对比分析' },
};

const currentTitle = computed(() => META[route.path]?.title || '舆情监测管理端');
const currentSubtitle = computed(() => META[route.path]?.subtitle || '');

function isMenuActive(path: string): boolean {
  if (!path) return false;
  return route.path === path || route.path.startsWith(path + '/');
}

function navigateTo(path: string): void {
  if (!path) return;
  if (path !== route.path && !route.path.startsWith(path + '/')) {
    router.push(path);
  }
}

function toggleCollapse(): void {
  if (window.innerWidth <= 767) {
    drawerVisible.value = true;
  } else {
    isCollapsed.value = !isCollapsed.value;
  }
}

const drawerVisible = ref(false);

function updateTime(): void {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  currentTime.value = `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function onCommand(cmd: string): void {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  }
}

const keepAliveIncludes = [
  'DashboardPage',
  'AgentsPage',
  'AgentDetailPage',
  'LlmModelsManagementPage',
  'KnowledgeBasesPage',
  'KnowledgeBaseDetailPage',
  'SystemLogsPage',
  'UserManagementPage',
  'SmsTemplatesPage',
  'HotTopicsPage',
  'AliyunSmsConfigPage',
  'AliyunVerifyConfigPage',
  'CompetitorTrackingPage',
  'AlertCenterPage',
];

onMounted(() => {
  updateTime();
  timer = window.setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: transparent;
}

.admin-aside {
  background: rgba(20, 25, 56, 0.7) !important;
  border-right: 1px solid var(--border-medium) !important;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 0;
  backdrop-filter: none;
  will-change: auto;
}

.menu-item:hover {
  background: rgba(94, 114, 228, 0.12);
  backdrop-filter: blur(6px);
}

.admin-aside__brand {
  padding: 24px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-aside__logo {
  filter: drop-shadow(0 4px 12px rgba(94, 114, 228, 0.4));
}

.admin-aside__title {
  flex: 1;
  min-width: 0;
}

.admin-aside__title-main {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.admin-aside__title-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-top: 2px;
}

.admin-aside__nav {
  flex: 1;
  padding: 20px 12px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  position: relative;
  white-space: nowrap;
  min-height: 42px;
}

.menu-item__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.menu-item__icon :deep(svg) {
  width: 18px !important;
  height: 18px !important;
  display: block;
}

.menu-item__text {
  flex: 1;
  display: inline-block !important;
  color: inherit !important;
  visibility: visible !important;
  opacity: 1 !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-item__badge {
  flex-shrink: 0;
  display: inline-block;
}

.menu-item:hover {
  background: rgba(94, 114, 228, 0.12);
  color: var(--text-primary);
  transform: translateX(2px);
}

.menu-item--active {
  background: var(--gradient-primary) !important;
  color: #fff !important;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.35);
}

.menu-item__badge {
  background: var(--color-danger);
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.admin-aside__footer {
  padding: 16px;
  border-top: 1px solid var(--border-subtle);
}

.admin-aside__user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.admin-aside__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.admin-aside__user-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.admin-aside__user-role {
  font-size: 11px;
  color: var(--text-tertiary);
}

.admin-main {
  background: transparent;
  padding: 0 !important;
  min-height: 100vh;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: rgba(20, 25, 56, 0.6);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
}

.admin-topbar__left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.admin-topbar__toggle {
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
}

.admin-topbar__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-topbar__time {
  font-size: 13px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}

.admin-topbar__user {
  padding: 8px 16px;
  background: var(--gradient-primary);
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.admin-topbar__user:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.45);
}

.admin-topbar__user-text {
  color: #fff;
}

.admin-content {
  padding: 32px;
  max-width: 1600px;
}

@media (max-width: 1024px) {
  .admin-aside {
    width: 64px !important;
  }
  .admin-aside__brand .admin-aside__title,
  .admin-aside__footer,
  .menu-item__text,
  .menu-item__badge {
    display: none;
  }
  .admin-aside__brand {
    justify-content: center;
  }
}
</style>
