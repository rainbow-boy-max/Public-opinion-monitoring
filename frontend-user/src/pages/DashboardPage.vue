<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="card in cards" :key="card.label">
        <el-card class="stat-card" @click="card.onClick && card.onClick()">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card style="margin-top: 20px">
      <template #header>快速操作</template>
      <el-space wrap>
        <el-button type="primary" @click="$router.push('/tasks')">创建监控任务</el-button>
        <el-button type="success" @click="$router.push('/webhooks')">配置 Webhook</el-button>
        <el-button type="warning" @click="$router.push('/realtime')">查看实时大屏</el-button>
      </el-space>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '@/utils/http';

const router = useRouter();
const taskCount = ref(0);
const webhookCount = ref(0);
const recentEventCount = ref(0);

const cards = ref([
  { label: '监控任务数', value: '0', onClick: () => router.push('/tasks') },
  { label: 'Webhook 数量', value: '0', onClick: () => router.push('/webhooks') },
  { label: '今日新增舆情', value: '0', onClick: () => router.push('/realtime') },
  { label: '未读告警', value: '0', onClick: () => router.push('/tasks') },
]);

async function load(): Promise<void> {
  try {
    const tasks = await http.get('/monitor-tasks');
    taskCount.value = (tasks || []).length;
    const webhooks = await http.get('/webhooks');
    webhookCount.value = (webhooks || []).length;
  } catch (err) {
    console.error(err);
  }
  cards.value[0].value = String(taskCount.value);
  cards.value[1].value = String(webhookCount.value);
  cards.value[2].value = String(recentEventCount.value);
  cards.value[3].value = String(recentEventCount.value);
}

onMounted(load);
</script>

<style scoped>
.stat-card {
  text-align: center;
  cursor: pointer;
}
.stat-label {
  color: #909399;
  font-size: 14px;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-top: 12px;
  color: #1890ff;
}
</style>
