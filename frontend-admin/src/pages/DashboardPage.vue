<template>
  <div class="dashboard-page">
    <div class="dashboard-stats">
      <StatCard
        v-for="(card, idx) in cards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
        :icon-bg="card.bg"
        :glow="card.glow"
        :trend="card.trend"
        trend-label="同比"
        @click="card.onClick"
      />
    </div>

    <div class="dashboard-filter">
      <span class="dashboard-filter__label">数据口径：</span>
      <el-radio-group v-model="roleFilter" size="small" @change="onRoleFilterChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="user">普通用户</el-radio-button>
        <el-radio-button value="admin">管理员</el-radio-button>
        <el-radio-button value="operator">运营</el-radio-button>
      </el-radio-group>
    </div>

    <div class="dashboard-row">
      <GlassCard title="趋势分析" icon="📈" subtitle="舆情趋势" class="dashboard-row__left">
        <template #extra>
          <el-radio-group v-model="dashboardRange" size="small" @change="loadDashboard">
            <el-radio-button :value="7">7天</el-radio-button>
            <el-radio-button :value="30">30天</el-radio-button>
            <el-radio-button :value="90">90天</el-radio-button>
            <el-radio-button :value="365">12个月</el-radio-button>
          </el-radio-group>
        </template>
        <div ref="trendChartEl" style="height: 320px" />
      </GlassCard>

      <GlassCard title="平台分布" icon="🌐" subtitle="数据来源占比" class="dashboard-row__right">
        <div ref="platformChartEl" style="height: 320px" />
      </GlassCard>
    </div>

    <GlassCard
      title="最近活动"
      icon="⚡"
      :subtitle="dashboardStreamSubtitle"
    >
      <template #extra>
        <el-button v-if="activities.connected.value" type="success" plain size="small" disabled>实时已连接</el-button>
        <el-button v-else-if="activities.unauthorized?.value" type="danger" plain size="small" @click="onReconnect">重新登录</el-button>
        <el-button v-else type="warning" plain size="small" @click="onReconnect">重新连接</el-button>
      </template>
      <el-empty v-if="!activities.loading.value && activities.items.value.length === 0" description="暂无活动" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="activity in activities.items.value"
          :key="activity.id"
          :timestamp="formatTime(activity.createdAt)"
          :type="activity.type"
        >
          <span style="font-weight: 500">{{ activity.title }}</span>
          <span
            v-if="activity.content"
            style="margin-left: 8px; color: var(--text-tertiary); font-size: 12px;"
          >
            {{ activity.content }}
          </span>
        </el-timeline-item>
      </el-timeline>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'DashboardPage' });

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { echarts, type EChartsOption } from '@/utils/echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';
import { useRecentActivities } from '@/composables/useRecentActivities';
import { startMark, endMark } from '@/utils/perf-metrics';

const router = useRouter();
const trendChartEl = ref<HTMLElement>();
const platformChartEl = ref<HTMLElement>();
const dashboardRange = ref(7);
let trendChart: echarts.ECharts | null = null;
let platformChart: echarts.ECharts | null = null;

interface DashboardKpis {
  usersTotal: number;
  monitorTasks: number;
  todaySentiment: number;
  pendingAlerts: number;
  activeAgents: number;
}

const cards = ref([
  { label: '总用户数', value: '-', icon: '👥', bg: 'var(--gradient-primary)', glow: 'rgba(94, 114, 228, 0.4)', trend: 0, onClick: () => router.push('/users') },
  { label: '监控任务', value: '-', icon: '🎯', bg: 'var(--gradient-cool)', glow: 'rgba(6, 182, 212, 0.4)', trend: 0, onClick: () => {} },
  { label: '今日舆情', value: '-', icon: '📊', bg: 'var(--gradient-warm)', glow: 'rgba(245, 158, 11, 0.4)', trend: 0, onClick: () => {} },
  { label: '未处理告警', value: '0', icon: '⚠️', bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', glow: 'rgba(16, 185, 129, 0.4)', trend: 0, onClick: () => {} },
]);

const roleFilter = ref('');

const dashboardStreamSubtitle = computed(() => {
  if (activities.connected.value) return '实时已连接 · 后端正在推送';
  if (activities.unauthorized?.value) return '鉴权失败，请重新登录';
  return '实时连接断开，每 5 秒自动重连';
});

function onRoleFilterChange(): void {
  loadOverview(true);
}

function onReconnect(): void {
  activities.reconnect?.();
  loadOverview(true);
}

function loadDashboard() {
  loadOverview();
}

const activities = useRecentActivities(20);

let refreshTimer: number | undefined;
let eventsBound = false;
function onUsersFilter(ev: Event): void {
  const detail = (ev as CustomEvent).detail as { role?: string };
  if (!detail) return;
  roleFilter.value = detail.role || '';
  loadOverview(true);
}

function bindCrossPageEvents(): void {
  if (eventsBound) return;
  eventsBound = true;
  window.addEventListener('admin:users-filter', onUsersFilter);
}
function unbindCrossPageEvents(): void {
  if (!eventsBound) return;
  eventsBound = false;
  window.removeEventListener('admin:users-filter', onUsersFilter);
}

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 40, right: 24, top: 32, bottom: 32 },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} 小时前`;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function initCharts(overview?: any): void {
  if (!trendChartEl.value && !platformChartEl.value) return;
  const trendData =
    overview?.trend7d && Array.isArray(overview.trend7d) && overview.trend7d.length > 0
      ? {
          sentiment: overview.trend7d.map((p: any) => p.sentiment),
          alerts: overview.trend7d.map((p: any) => p.alerts),
          dates: overview.trend7d.map((p: any) => p.date?.slice(5) || ''),
        }
      : {
          sentiment: [120, 200, 150, 280, 220, 350, 290],
          alerts: [12, 18, 8, 22, 15, 28, 19],
          dates: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        };
  const platformData =
    overview?.platformDistribution && overview.platformDistribution.length > 0
      ? overview.platformDistribution.map((p: any) => ({
          value: p.count,
          name: p.platform,
        }))
      : [
          { value: 1048, name: '微博' },
          { value: 735, name: '微信公众号' },
          { value: 580, name: '抖音' },
          { value: 484, name: '小红书' },
        ];
  if (trendChartEl.value) {
    if (!trendChart) trendChart = echarts.init(trendChartEl.value);
    trendChart.setOption({
      ...ECHART_BASE,
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
      xAxis: { type: 'category', data: trendData.dates, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
      series: [
        { name: '舆情数', type: 'line', smooth: true, data: trendData.sentiment, symbolSize: 8, itemStyle: { color: '#5E72E4' }, lineStyle: { width: 3, color: '#5E72E4' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(94, 114, 228, 0.4)' },
          { offset: 1, color: 'rgba(94, 114, 228, 0)' },
        ]) } },
        { name: '告警数', type: 'line', smooth: true, data: trendData.alerts, symbolSize: 8, itemStyle: { color: '#10B981' }, lineStyle: { width: 3, color: '#10B981' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
          { offset: 1, color: 'rgba(16, 185, 129, 0)' },
        ]) } },
      ],
    });
  }
  if (platformChartEl.value) {
    if (!platformChart) platformChart = echarts.init(platformChartEl.value);
    platformChart.setOption({
      ...ECHART_BASE,
      tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
      legend: { bottom: 0, textStyle: { color: '#9DA8E5' } },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 8, borderColor: 'rgba(20,25,56,0.6)', borderWidth: 2 },
          label: { color: '#E8EBFF', fontSize: 12 },
          data: platformData,
        },
      ],
    });
  }
}

async function loadOverview(skipChart = false): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    if (roleFilter.value) params.roleFilter = roleFilter.value;
    const res = await http.get('/admin/dashboard/overview', { params });
    applyOverview(res);
    if (!skipChart) initCharts();
  } catch {
    for (let i = 0; i < cards.value.length; i++) {
      cards.value[i].value = '—';
    }
  }
}

function applyOverview(overview: any): void {
  const kpis: DashboardKpis = overview.kpis || {};
  cards.value[0].value = String(kpis.usersTotal ?? 0);
  cards.value[1].value = String(kpis.monitorTasks ?? 0);
  cards.value[2].value = String(kpis.todaySentiment ?? 0);
  cards.value[3].value = String(kpis.pendingAlerts ?? 0);
  initCharts(overview);
}

const onResize = (): void => {
  trendChart?.resize();
  platformChart?.resize();
};

onMounted(async () => {
  await nextTick();
  bindCrossPageEvents();
  startMark('dashboard-mount');
  await loadOverview();
  startMark('echarts-init');
  initCharts();
  endMark('echarts-init', { charts: ['trend', 'platform'] });
  endMark('dashboard-mount');
  refreshTimer = window.setInterval(() => loadOverview(true), 60_000);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  window.removeEventListener('resize', onResize);
  unbindCrossPageEvents();
  if (trendChart) trendChart.dispose();
  if (platformChart) platformChart.dispose();
  trendChart = null;
  platformChart = null;
});
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.dashboard-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
}

.dashboard-filter__label {
  color: var(--text-tertiary);
  font-weight: 500;
}

.dashboard-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

@media (max-width: 1024px) {
  .dashboard-row {
    grid-template-columns: 1fr;
  }
}
</style>
