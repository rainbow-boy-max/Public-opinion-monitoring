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
        <template v-for="item in menuItems" :key="item.label">
          <!-- 有子菜单的父级 -->
          <div v-if="item.children && item.children.length" class="menu-group">
            <div class="menu-group__header" @click="toggleGroup(item.label)">
              <span class="menu-item__icon" :innerHTML="item.icon" />
              <span class="menu-item__text" v-show="!isCollapsed">{{ item.label }}</span>
              <el-icon v-show="!isCollapsed" class="menu-group__arrow" :class="{ 'is-open': openGroups.includes(item.label) }">
                <ArrowDown />
              </el-icon>
            </div>
            <div v-show="!isCollapsed && openGroups.includes(item.label)" class="menu-group__children">
              <div
                v-for="child in item.children"
                :key="child.path"
                class="menu-item menu-item--child"
                :class="{ 'menu-item--active': isMenuActive(child.path) }"
                @click="navigateTo(child.path)"
              >
                <span class="menu-item__icon menu-item__icon--child" :innerHTML="child.icon" />
                <span class="menu-item__text">{{ child.label }}</span>
              </div>
            </div>
          </div>
          <!-- 无子菜单的直接项 -->
          <div
            v-else
            class="menu-item"
            :class="{ 'menu-item--active': isMenuActive(item.path) }"
            @click="navigateTo(item.path)"
          >
            <span class="menu-item__icon" :innerHTML="item.icon" />
            <span class="menu-item__text" v-show="!isCollapsed">{{ item.label }}</span>
            <span v-if="item.badge" class="menu-item__badge" v-show="!isCollapsed">{{ item.badge }}</span>
          </div>
        </template>
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
          <el-tooltip :content="isDark ? '切换亮色主题' : '切换暗色主题'" placement="bottom">
            <el-icon class="admin-topbar__theme-toggle" @click="toggleTheme">
              <Moon v-if="isDark" />
              <Sunny v-else />
            </el-icon>
          </el-tooltip>
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
  <el-drawer v-model="drawerVisible" :size="drawerSize" direction="ltr" :with-header="false" :z-index="2000">
    <template #default>
      <div class="drawer-content">
        <div class="drawer-content__brand">
          <div class="drawer-content__logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <defs><linearGradient id="dlgGrad" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stop-color="#5E72E4" /><stop offset="100%" stop-color="#7C3AED" /></linearGradient></defs>
              <rect width="32" height="32" rx="8" fill="url(#dlgGrad)" />
              <path d="M8 20L14 12L18 16L24 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <circle cx="24" cy="10" r="2" fill="white" />
            </svg>
          </div>
          <div class="drawer-content__title">
            <div class="drawer-content__title-main">舆情监测</div>
            <div class="drawer-content__title-sub">Super Admin</div>
          </div>
        </div>
<nav class="drawer-content__nav">
          <template v-for="item in menuItems" :key="item.label">
            <div v-if="item.children && item.children.length" class="drawer-group">
              <div class="drawer-group__header">{{ item.label }}</div>
              <div
                v-for="child in item.children"
                :key="child.path"
                class="drawer-item"
                :class="{ 'drawer-item--active': isMenuActive(child.path) }"
                @click="navigateTo(child.path); drawerVisible = false"
              >
                <span class="drawer-item__icon" :innerHTML="child.icon" />
                <span class="drawer-item__text">{{ child.label }}</span>
              </div>
            </div>
            <div
              v-else
              class="drawer-item"
              :class="{ 'drawer-item--active': isMenuActive(item.path) }"
              @click="navigateTo(item.path); drawerVisible = false"
            >
              <span class="drawer-item__icon" :innerHTML="item.icon" />
              <span class="drawer-item__text">{{ item.label }}</span>
            </div>
          </template>
        </nav>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Expand, Fold, SwitchButton, Operation, Sunny, Moon, ArrowDown } from '@element-plus/icons-vue';
import { useAdminAuthStore } from '@/store/auth';
import { useTheme } from '@/composables/useTheme';
import { useIdleDetection } from '@/composables/useIdleDetection';

const route = useRoute();
const router = useRouter();
const auth = useAdminAuthStore();
const { isDark, toggleTheme } = useTheme();

useIdleDetection(() => {
  auth.logout();
  router.push('/login');
});

interface MenuItem {
  path?: string;
  label: string;
  icon: string;
  badge?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    path: '/dashboard', label: '概览',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  },
  {
    label: '监测分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    children: [
      { path: '/monitor-tasks', label: '监控任务', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
      { path: '/hot-topics', label: '热点话题', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
      { path: '/short-video', label: '短视频监控', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>' },
      { path: '/ecommerce', label: '电商监测', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>' },
    ],
  },
  {
    label: 'AI 能力', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>',
    children: [
      { path: '/agents', label: 'AI 智能体', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><circle cx="12" cy="5" r="2"></circle></svg>' },
      { path: '/agent-templates', label: '模板市场', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
      { path: '/llm-models', label: 'LLM 模型', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>' },
      { path: '/knowledge', label: 'AI 知识库', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>' },
      { path: '/pr-reports', label: 'AI 公关报告', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>' },
      { path: '/knowledge-graph', label: '知识图谱', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
    ],
  },
  {
    label: '预警处置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    children: [
      { path: '/alert', label: '预警中心', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line></svg>' },
      { path: '/work-orders', label: '事件工单', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><path d="M9 14l2 2 4-4"></path></svg>' },
      { path: '/duty', label: '值班面板', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
    ],
  },
  {
    label: '对比分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    children: [
      { path: '/competitor-tracking', label: '竞品追踪', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>' },
      { path: '/comparison', label: '多维对比', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' },
      { path: '/brand-reputation', label: '品牌声誉', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>' },
      { path: '/kol', label: 'KOL 分析', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>' },
    ],
  },
  {
    label: '政务场景', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
    children: [
      { path: '/gov-briefing', label: '政务简报', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
      { path: '/gov-instruction', label: '领导批示', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>' },
      { path: '/gov-monitor', label: '官网监测', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' },
    ],
  },
  {
    label: '系统配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    children: [
      { path: '/config/aliyun-sms', label: '短信配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>' },
      { path: '/sms-templates', label: '短信模板', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' },
      { path: '/config/aliyun-verify', label: '三要素认证', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
      { path: '/config/web-search', label: 'Web 搜索', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' },
      { path: '/config/kb-scoring', label: 'AI 打分', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' },
      { path: '/config/tts', label: 'TTS 语音', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' },
      { path: '/config/ocr', label: 'OCR 识别', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' },
      { path: '/config/captcha', label: '验证码配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
      { path: '/config/hot-topics', label: '热点配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
      { path: '/config/knowledge-graph', label: '图谱模型配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
    ],
  },
  {
    label: '权限管理', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    children: [
      { path: '/users', label: '用户管理', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
      { path: '/tenants', label: '租户管理', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' },
      { path: '/api-management', label: 'API 密钥', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>' },
      { path: '/api-docs', label: 'API 文档', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>' },
    ],
  },
  {
    label: '系统', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    children: [
      { path: '/system-logs', label: '系统日志', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>' },
      { path: '/export-config', label: '导出配置', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' },
      { path: '/ops-monitor', label: '系统监控', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>' },
      { path: '/mfa-settings', label: 'MFA 认证', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
    ],
},
];

const currentTime = ref('');
let timer: number | undefined;
const isCollapsed = ref(false);

const META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: '概览', subtitle: '系统关键指标与状态' },
  '/monitor-tasks': { title: '监控任务', subtitle: '查看和管理所有监控任务' },
  '/users': { title: '用户管理', subtitle: '注册用户与权限控制' },
  '/agents': { title: 'AI 智能体', subtitle: '自定义 AI 智能体与知识库' },
  '/agent-templates': { title: 'AI 智能体模板市场', subtitle: '预置模板，一键部署' },
  '/llm-models': { title: 'LLM 模型', subtitle: '管理 6 大厂商与自定义模型' },
  '/knowledge': { title: 'AI 知识库', subtitle: '独立知识库 · AI 解析 · AI 打分 · AI 增强' },
  '/config/aliyun-sms': { title: '短信配置', subtitle: '阿里云短信服务接入' },
  '/sms-templates': { title: '短信模板', subtitle: '7 大场景短信模板管理 + 一键报备' },
  '/config/aliyun-verify': { title: '三要素认证配置', subtitle: '阿里云手机号三要素详细版' },
  '/config/web-search': { title: 'Web 搜索配置', subtitle: 'AI 智能体联网搜索 Provider 与 Key' },
  '/config/kb-scoring': { title: 'AI 打分配置', subtitle: '知识库文档 AI 自动评分模型与能力设置' },
  '/config/tts': { title: 'TTS 语音合成', subtitle: 'MiniMax TTS 语音播报服务配置与试听' },
  '/system-logs': { title: '系统日志', subtitle: 'API 请求与异常记录' },
  '/alert': { title: '预警中心', subtitle: '预警规则与触发记录' },
  '/keyword-extension': { title: '关键词扩展', subtitle: 'AI 智能关键词拓展推荐' },
  '/custom-dashboard': { title: '自定义面板', subtitle: '可拖拽组件式仪表盘' },
  '/comparison': { title: '多维对比分析', subtitle: '多关键词组对比分析' },
  '/hot-topics': { title: '热点话题', subtitle: '上升热点发现与聚合管理' },
  '/config/hot-topics': { title: '热点话题配置', subtitle: '数据源选择与刷新策略' },
  '/pr-reports': { title: 'AI 公关报告', subtitle: '全量用户报告管理与审核' },
  '/short-video': { title: '短视频监控', subtitle: '多平台短视频数据监控与分析' },
  '/competitor-tracking': { title: '竞品追踪', subtitle: '竞品动态对比分析' },
  '/work-orders': { title: '工单管理', subtitle: '人工分析与处置工作流' },
  '/kol': { title: 'KOL 分析', subtitle: '关键意见领袖影响力分析' },
  '/brand-reputation': { title: '品牌声誉', subtitle: '品牌声量 / NPS 趋势 / 竞品排名' },
  '/knowledge-graph': { title: '知识图谱', subtitle: '行业实体知识图谱可视化分析' },
  '/config/knowledge-graph': { title: '知识图谱模型配置', subtitle: '选择知识图谱 LLM 模型' },
  '/config/ocr': { title: 'OCR 识别配置', subtitle: '图片文字识别服务管理' },
  '/ecommerce': { title: '电商监测', subtitle: '电商平台评论监控与情感分析' },
  '/report-templates': { title: '报告模板', subtitle: '预设与自定义报告模板市场' },
  '/tenants': { title: '租户管理', subtitle: '多租户管理与数据隔离' },
  '/duty': { title: '值班面板', subtitle: '7x24 小时值班监控' },
  '/api-management': { title: 'API 密钥管理', subtitle: 'Open API 密钥与统计' },
  '/api-docs': { title: 'API 文档', subtitle: 'Open API 接口参考' },
  '/gov-briefing': { title: '政务简报', subtitle: '生成、导出与上报舆情简报' },
  '/gov-instruction': { title: '领导批示', subtitle: '领导批示登记、流转与反馈' },
  '/gov-monitor': { title: '官网监测', subtitle: '政府官网变更监测与异常发现' },
};

const currentTitle = computed(() => META[route.path]?.title || '舆情监测管理端');
const currentSubtitle = computed(() => META[route.path]?.subtitle || '');

function navigateTo(path: string | undefined): void {
  if (!path) return;
  if (path !== route.path && !route.path.startsWith(path + '/')) {
    router.push(path);
  }
}

function toggleCollapse(): void {
  if (window.innerWidth <= 1023) {
    drawerVisible.value = true;
  } else {
    isCollapsed.value = !isCollapsed.value;
  }
}

const drawerVisible = ref(false);
const drawerSize = ref(260);
const openGroups = ref<string[]>(['概览', '监测分析', 'AI 能力', '预警处置', '对比分析', '政务场景', '系统配置', '权限管理', '系统']);

function toggleGroup(label: string): void {
  const idx = openGroups.value.indexOf(label);
  if (idx >= 0) {
    openGroups.value.splice(idx, 1);
  } else {
    openGroups.value.push(label);
  }
}

function isMenuActive(path: string | undefined): boolean {
  if (!path) return false;
  if (path === route.path) return true;
  if (path !== '/' && route.path.startsWith(path + '/')) return true;
  if (path !== '/' && route.path.startsWith(path)) return true;
  return false;
}

function updateDrawerSize(): void {
  drawerSize.value = Math.min(260, Math.max(200, window.innerWidth - 40));
}

onMounted(updateDrawerSize);
window.addEventListener('resize', updateDrawerSize);

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
  'AgentTemplatesPage',
  'AgentDetailPage',
  'LlmModelsManagementPage',
  'KnowledgeBasesPage',
  'KnowledgeBaseDetailPage',
  'SystemLogsPage',
  'UserManagementPage',
  'SmsTemplatesPage',
  'HotTopicsPage',
  'HotTopicsConfigPage',
  'AliyunSmsConfigPage',
  'AliyunVerifyConfigPage',
  'CompetitorTrackingPage',
  'AlertCenterPage',
  'KeywordExtensionPage',
  'ComparisonPage',
  'BrandReputationPage',
  'KnowledgeGraphPage',
  'KnowledgeGraphConfigPage',
  'WorkOrdersPage',
  'TenantsPage',
  'EcommerceConfigPage',
  'OcrConfigPage',
  'AdminReportTemplatesPage',
  'DutyDashboardPage',
  'ApiManagementPage',
  'ApiDocsPage',
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
  background: var(--color-primary, #5E72E4);
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: auto;
  line-height: 16px;
}

.menu-group__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  color: var(--text-secondary, #9DA8E5);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;
}
.menu-group__header:hover {
  color: #fff;
  background: rgba(94, 114, 228, 0.08);
}
.menu-group__arrow {
  margin-left: auto;
  transition: transform 0.2s;
  font-size: 14px;
}
.menu-group__arrow.is-open {
  transform: rotate(180deg);
}
.menu-group__children {
  overflow: hidden;
}
.menu-item--child {
  padding-left: 46px !important;
  font-size: 13px;
}
.menu-item--child .menu-item__icon--child {
  width: 14px;
  height: 14px;
  opacity: 0.7;
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

.admin-topbar__theme-toggle {
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.admin-topbar__theme-toggle:hover {
  color: var(--color-primary);
  transform: rotate(15deg);
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

/* ---- 抽屉菜单样式（独立于 PC 侧边栏，不受媒体查询影响） ---- */
.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-cosmic, #0f132f);
}
.drawer-content__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
}
.drawer-content__logo {
  flex-shrink: 0;
}
.drawer-content__title-main {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #A78BFA 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.drawer-content__title-sub {
  font-size: 11px;
  color: var(--text-tertiary, #6B7280);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.drawer-content__nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.drawer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  color: var(--text-secondary, #9DA8E5);
  font-size: 14px;
  transition: all 0.2s;
  position: relative;
}
.drawer-item:hover {
  background: rgba(94, 114, 228, 0.12);
  color: #fff;
}
.drawer-item--active {
  background: rgba(94, 114, 228, 0.15);
  color: #5E72E4;
  font-weight: 600;
}
.drawer-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: #5E72E4;
  border-radius: 0 3px 3px 0;
}
.drawer-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.drawer-item__text {
  font-size: 14px;
  white-space: nowrap;
}
.drawer-group__header {
  padding: 8px 20px 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary, #6B7280);
  text-transform: uppercase;
  letter-spacing: 1px;
}
</style>
