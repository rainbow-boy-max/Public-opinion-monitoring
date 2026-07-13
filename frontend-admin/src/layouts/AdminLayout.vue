<template>
  <el-container class="admin-layout">
    <el-aside width="220px" class="aside">
      <div class="logo">舆情监测 - 管理端</div>
      <el-menu :default-active="route.path" router class="menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>概览</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/config/aliyun-sms">
          <el-icon><Message /></el-icon>
          <span>阿里云短信配置</span>
        </el-menu-item>
        <el-menu-item index="/config/aliyun-verify">
          <el-icon><Lock /></el-icon>
          <span>三要素认证配置</span>
        </el-menu-item>
        <el-menu-item index="/system-logs">
          <el-icon><Document /></el-icon>
          <span>系统日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left"></div>
        <div class="header-right">
          <el-dropdown @command="onCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              {{ auth.user?.username }}
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAdminAuthStore } from '@/store/auth';
import {
  DataLine,
  User,
  Message,
  Lock,
  Document,
  UserFilled,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const auth = useAdminAuthStore();

function onCommand(cmd: string): void {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
}
.aside {
  background: #001529;
  color: #fff;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid #1f2a3a;
}
.menu {
  border-right: 0;
  background: transparent;
}
.menu :deep(.el-menu-item) {
  color: #c0c4cc;
}
.menu :deep(.el-menu-item.is-active) {
  background: #1890ff;
  color: #fff;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 20px;
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
