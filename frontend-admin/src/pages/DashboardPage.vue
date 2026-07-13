<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in statsCards" :key="card.label">
        <el-card class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card class="recent-card" style="margin-top: 20px">
      <template #header>
        <span>系统状态</span>
      </template>
      <p>欢迎使用舆情监测系统管理端。当前所有功能均已就绪。</p>
      <p>如需修改阿里云短信或三要素认证配置，请进入相应菜单。</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

const statsCards = ref([
  { label: '总用户数', value: '-' },
  { label: '今日注册', value: '-' },
  { label: '今日短信发送', value: '-' },
  { label: '监控任务数', value: '-' },
]);

async function loadStats(): Promise<void> {
  try {
    const res = await http.get('/admin/users', { params: { page: 1, pageSize: 1 } });
    if (res?.total !== undefined) statsCards.value[0].value = String(res.total);
  } catch {
    // dashboard stats endpoint optional
  }
}

onMounted(loadStats);
</script>

<style scoped>
.stat-card {
  text-align: center;
}
.stat-label {
  color: #909399;
  font-size: 14px;
}
.stat-value {
  color: #303133;
  font-size: 28px;
  font-weight: bold;
  margin-top: 12px;
}
.recent-card {
  min-height: 240px;
}
</style>
