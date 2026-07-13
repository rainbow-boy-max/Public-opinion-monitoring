<template>
  <el-container class="user-layout">
    <el-header class="header">
      <div class="logo">舆情监测</div>
      <el-menu mode="horizontal" :default-active="route.path" router class="nav-menu">
        <el-menu-item index="/dashboard">概览</el-menu-item>
        <el-menu-item index="/tasks">监控任务</el-menu-item>
        <el-menu-item index="/webhooks">Webhook</el-menu-item>
        <el-menu-item index="/realtime">实时大屏</el-menu-item>
      </el-menu>
      <div class="header-right">
        <el-dropdown @command="onCommand">
          <span class="user-info">
            <el-icon><UserFilled /></el-icon>
            {{ auth.user?.username }}
            <el-tag v-if="auth.user?.authStatus !== 'verified'" type="warning" size="small">
              未实名
            </el-tag>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人设置</el-dropdown-item>
              <el-dropdown-item command="verify">实名认证</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useUserAuthStore } from '@/store/auth';
import { UserFilled } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useUserAuthStore();

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
  height: 100vh;
}
.header {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 20px;
  gap: 24px;
}
.logo {
  font-size: 18px;
  font-weight: bold;
  color: #1890ff;
}
.nav-menu {
  flex: 1;
  border-bottom: none;
}
.header-right {
  display: flex;
  align-items: center;
}
.user-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.main {
  background: #f5f5f5;
  padding: 20px;
}
</style>
