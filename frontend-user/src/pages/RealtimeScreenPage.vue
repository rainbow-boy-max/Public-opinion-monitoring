<template>
  <div class="realtime-screen">
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6" v-for="card in summaryCards" :key="card.label">
        <el-card class="summary-card">
          <div class="summary-label">{{ card.label }}</div>
          <div class="summary-value">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>各平台占比</template>
          <div ref="platformChartEl" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>情感分布</template>
          <div ref="sentimentChartEl" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 20px">
      <template #header>
        <div class="header">
          <span>实时舆情事件流</span>
          <el-space>
            <el-tag :type="wsConnected ? 'success' : 'danger'" size="small">
              {{ wsConnected ? '已连接' : '未连接' }}
            </el-tag>
            <el-button size="small" @click="clearEvents">清空</el-button>
          </el-space>
        </div>
      </template>
      <el-table :data="events" max-height="500">
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.matchedAt || row.publishedAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="100" />
        <el-table-column label="标题">
          <template #default="{ row }">
            <a :href="row.url" target="_blank" style="color: #1890ff">
              {{ row.title }}
            </a>
          </template>
        </el-table-column>
        <el-table-column prop="readCount" label="阅读" width="80" />
        <el-table-column label="情感" width="80">
          <template #default="{ row }">
            <el-tag :type="sentimentTag(row.sentiment)" size="small">
              {{ sentimentLabel(row.sentiment) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { io, Socket } from 'socket.io-client';
import * as echarts from 'echarts';
import http from '@/utils/http';

interface EventRow {
  id: number;
  platform: string;
  title: string;
  url: string;
  readCount: number;
  sentiment: string;
  matchedAt?: string;
  publishedAt?: string;
}

const events = ref<EventRow[]>([]);
const wsConnected = ref(false);
const summaryCards = ref([
  { label: '总舆情数', value: '0' },
  { label: '今日新增', value: '0' },
  { label: '活跃平台', value: '0' },
  { label: '负面占比', value: '0%' },
]);

const platformChartEl = ref<HTMLElement>();
const sentimentChartEl = ref<HTMLElement>();
let platformChart: echarts.ECharts | null = null;
let sentimentChart: echarts.ECharts | null = null;
let socket: Socket | null = null;
let statsTimer: number | null = null;

function sentimentLabel(s: string): string {
  return ({ positive: '正面', negative: '负面', neutral: '中性' } as Record<string, string>)[s] || s;
}

function sentimentTag(s: string): 'success' | 'danger' | 'info' {
  return ({ positive: 'success', negative: 'danger', neutral: 'info' } as any)[s] || 'info';
}

async function fetchMyTaskIds(): Promise<number[]> {
  try {
    const tasks = await http.get('/monitor-tasks');
    return (tasks || []).map((t: any) => t.id);
  } catch {
    return [];
  }
}

async function connectSocket(): Promise<void> {
  const taskIds = await fetchMyTaskIds();
  const token = localStorage.getItem('user_token') || '';
  socket = io({
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    wsConnected.value = true;
    if (taskIds.length > 0) {
      socket?.emit('subscribe:tasks', { taskIds });
    }
  });

  socket.on('disconnect', () => {
    wsConnected.value = false;
  });

  socket.on('opinion:new', (payload: EventRow) => {
    if (events.value.length >= 200) events.value.pop();
    events.value.unshift(payload);
    loadStats();
  });

  socket.on('opinion:stats', (stats: any) => {
    summaryCards.value[0].value = String(stats.total || 0);
    summaryCards.value[1].value = String(
      stats.byPlatform ? Object.values(stats.byPlatform).reduce((a: any, b: any) => a + b, 0) : 0,
    );
    summaryCards.value[2].value = String(stats.byPlatform ? Object.keys(stats.byPlatform).length : 0);
    const total = (stats.bySentiment?.positive || 0) + (stats.bySentiment?.negative || 0) + (stats.bySentiment?.neutral || 0);
    const neg = stats.bySentiment?.negative || 0;
    summaryCards.value[3].value = total > 0 ? `${Math.round((neg / total) * 100)}%` : '0%';

    updateCharts(stats);
  });
}

async function loadStats(): Promise<void> {
  // stats arrive via WS
}

function updateCharts(stats: any): void {
  if (platformChart && stats.byPlatform) {
    platformChart.setOption({
      title: { text: '各平台舆情占比', left: 'center' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: Object.entries(stats.byPlatform).map(([name, value]) => ({ name, value })),
        },
      ],
    });
  }
  if (sentimentChart && stats.bySentiment) {
    sentimentChart.setOption({
      title: { text: '情感倾向分布', left: 'center' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: [
            { name: '正面', value: stats.bySentiment.positive, itemStyle: { color: '#67c23a' } },
            { name: '负面', value: stats.bySentiment.negative, itemStyle: { color: '#f56c6c' } },
            { name: '中性', value: stats.bySentiment.neutral, itemStyle: { color: '#909399' } },
          ],
        },
      ],
    });
  }
}

function clearEvents(): void {
  events.value = [];
}

onMounted(async () => {
  await nextTick();
  if (platformChartEl.value) platformChart = echarts.init(platformChartEl.value);
  if (sentimentChartEl.value) sentimentChart = echarts.init(sentimentChartEl.value);
  await connectSocket();
  statsTimer = window.setInterval(() => {
    // periodic refresh
  }, 5000);
});

onUnmounted(() => {
  if (socket) socket.disconnect();
  if (statsTimer) window.clearInterval(statsTimer);
  if (platformChart) platformChart.dispose();
  if (sentimentChart) sentimentChart.dispose();
});
</script>

<style scoped>
.realtime-screen {
  min-height: 100%;
}
.summary-card {
  text-align: center;
}
.summary-label {
  color: #909399;
  font-size: 14px;
}
.summary-value {
  font-size: 28px;
  font-weight: bold;
  margin-top: 12px;
  color: #1890ff;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
