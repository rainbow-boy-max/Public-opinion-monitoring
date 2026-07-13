<template>
  <div class="user-layout">
    <header class="user-topbar">
      <div class="user-topbar__brand">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <defs>
            <linearGradient id="userBrandGrad" x1="0" y1="0" x2="36" y2="36">
              <stop offset="0%" stop-color="#5E72E4" />
              <stop offset="100%" stop-color="#7C3AED" />
            </linearGradient>
          </defs>
          <rect width="36" height="36" rx="10" fill="url(#userBrandGrad)" />
          <path d="M9 22.5L16.5 13.5L21 18L27 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="27" cy="12" r="2" fill="white" />
        </svg>
        <div class="user-topbar__title">
          <div class="user-topbar__title-main">舆情监测</div>
          <div class="user-topbar__title-sub">User Panel</div>
        </div>
      </div>

      <nav class="user-nav">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          custom
          v-slot="{ navigate, isActive }"
        >
          <div class="user-nav__item" :class="{ 'user-nav__item--active': isActive }" @click="navigate">
            <span class="user-nav__icon" v-html="item.icon" />
            <span>{{ item.label }}</span>
          </div>
        </router-link>
      </nav>

      <div class="user-topbar__right">
        <div v-if="auth.user?.authStatus !== 'verified'" class="user-topbar__warning" @click="$router.push('/verify')">
          <span>⚠️</span>
          <span>未实名认证</span>
        </div>
        <el-dropdown @command="onCommand">
          <div class="user-topbar__user">
            <div class="user-topbar__avatar">
              {{ (auth.user?.username || '?').charAt(0).toUpperCase() }}
            </div>
            <span class="user-topbar__name">{{ auth.user?.username }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <span style="margin-right: 6px">👤</span>个人资料
              </el-dropdown-item>
              <el-dropdown-item command="verify">
                <span style="margin-right: 6px">🛡️</span>实名认证
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <span style="margin-right: 6px">🚪</span>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="user-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUserAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useUserAuthStore();

interface MenuItem {
  path: string;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  {
    path: '/dashboard',
    label: '概览',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  },
  {
    path: '/tasks',
    label: '监控任务',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
  },
  {
    path: '/webhooks',
    label: 'Webhook',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.27 3.27 0 0 0 .09-.7c0-.24-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path></svg>',
  },
  {
    path: '/realtime',
    label: '实时大屏',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
  },
  {
    path: '/pr',
    label: 'AI 公关',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>',
  },
];

function onCommand(cmd: string): void {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  } else if (cmd === 'verify') {
    router.push('/verify');
  } else if (cmd === 'profile') {
    router.push('/profile');
  }
}
</script>

<style scoped>
.user-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.user-topbar {
  display: grid;
  grid-template-columns: 240px 1fr auto;
  align-items: center;
  padding: 12px 28px;
  background: rgba(15, 19, 47, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 100;
}

.user-topbar__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-topbar__brand svg {
  filter: drop-shadow(0 4px 12px rgba(94, 114, 228, 0.4));
}

.user-topbar__title-main {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #A78BFA 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.user-topbar__title-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.user-nav {
  display: flex;
  gap: 4px;
  justify-self: start;
  margin-left: 32px;
}

.user-nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.user-nav__item:hover {
  background: rgba(94, 114, 228, 0.12);
  color: var(--text-primary);
}

.user-nav__item--active {
  background: var(--gradient-primary) !important;
  color: #fff !important;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.35);
}

.user-nav__icon {
  display: inline-flex;
  align-items: center;
}

.user-topbar__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-topbar__warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 999px;
  font-size: 12px;
  color: var(--color-warning);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-topbar__warning:hover {
  background: rgba(245, 158, 11, 0.25);
}

.user-topbar__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--glass-bg);
  border: 1px solid var(--border-medium);
  border-radius: 999px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.user-topbar__user:hover {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.12);
}

.user-topbar__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.user-topbar__name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.user-main {
  flex: 1;
  padding: 32px;
  max-width: 1600px;
  width: 100%;
  align-self: center;
}

@media (max-width: 768px) {
  .user-nav {
    display: none;
  }
  .user-topbar {
    grid-template-columns: auto 1fr;
  }
}
</style>
