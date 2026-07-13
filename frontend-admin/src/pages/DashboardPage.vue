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

    <div class="dashboard-row">
      <GlassCard title="趋势分析" icon="📈" subtitle="最近 7 天舆情趋势" class="dashboard-row__left">
        <div ref="trendChartEl" style="height: 320px" />
      </GlassCard>

      <GlassCard title="平台分布" icon="🌐" subtitle="数据来源占比" class="dashboard-row__right">
        <div ref="platformChartEl" style="height: 320px" />
      </GlassCard>
    </div>

    <GlassCard title="最近活动" icon="⚡" subtitle="系统最新动态">
      <el-timeline>
        <el-timeline-item
          v-for="(activity, idx) in recentActivities"
          :key="idx"
          :timestamp="activity.time"
          :type="activity.type"
        >
          {{ activity.content }}
        </el-timeline-item>
      </el-timeline>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';

const router = useRouter();
const trendChartEl = ref<HTMLElement>();
const platformChartEl = ref<HTMLElement>();
let trendChart: echarts.ECharts | null = null;
let platformChart: echarts.ECharts | null = null;

const cards = ref([
  {
    label: '总用户数',
    value: '-',
    icon: '👥',
    bg: 'var(--gradient-primary)',
    glow: 'rgba(94, 114, 228, 0.4)',
    trend: 12.5,
    onClick: () => router.push('/users'),
  },
  {
    label: '监控任务',
    value: '-',
    icon: '🎯',
    bg: 'var(--gradient-cool)',
    glow: 'rgba(6, 182, 212, 0.4)',
    trend: 8.3,
    onClick: () => {},
  },
  {
    label: '今日舆情',
    value: '-',
    icon: '📊',
    bg: 'var(--gradient-warm)',
    glow: 'rgba(245, 158, 11, 0.4)',
    trend: 24.7,
    onClick: () => {},
  },
  {
    label: '系统告警',
    value: '0',
    icon: '⚠️',
    bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    glow: 'rgba(16, 185, 129, 0.4)',
    trend: 0,
    onClick: () => {},
  },
]);

const recentActivities = ref([
  { time: '刚刚', type: 'primary', content: '系统启动完成，12 个业务模块已就绪' },
  { time: '2 分钟前', type: 'success', content: '管理员 admin 登录成功' },
  { time: '5 分钟前', type: 'info', content: '定时任务加载完成，已调度 0 个监控任务' },
  { time: '10 分钟前', type: 'warning', content: 'WebSocket 网关启动并订阅 Redis Pub/Sub 通道' },
]);

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 40, right: 24, top: 32, bottom: 32 },
};

function initCharts(): void {
  if (trendChartEl.value) {
    trendChart = echarts.init(trendChartEl.value);
    trendChart.setOption({
      ...ECHART_BASE,
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
      series: [
        {
          name: '舆情数',
          type: 'line',
          smooth: true,
          data: [120, 200, 150, 280, 220, 350, 290],
          symbolSize: 8,
          itemStyle: { color: '#5E72E4' },
          lineStyle: { width: 3, color: '#5E72E4' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(94, 114, 228, 0.4)' },
            { offset: 1, color: 'rgba(94, 114, 228, 0)' },
          ]) },
        },
        {
          name: '告警数',
          type: 'line',
          smooth: true,
          data: [12, 18, 8, 22, 15, 28, 19],
          symbolSize: 8,
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 3, color: '#10B981' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0)' },
          ]) },
        },
      ],
    });
  }
  if (platformChartEl.value) {
    platformChart = echarts.init(platformChartEl.value);
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
          data: [
            { value: 1048, name: '微博', itemStyle: { color: '#FF5C5C' } },
            { value: 735, name: '微信公众号', itemStyle: { color: '#10B981' } },
            { value: 580, name: '抖音', itemStyle: { color: '#EF4444' } },
            { value: 484, name: '小红书', itemStyle: { color: '#EC4899' } },
            { value: 300, name: '百家号', itemStyle: { color: '#3B82F6' } },
            { value: 250, name: '视频号', itemStyle: { color: '#34D399' } },
            { value: 200, name: '快手', itemStyle: { color: '#F59E0B' } },
          ],
        },
      ],
    });
  }
}

async function loadStats(): Promise<void> {
  try {
    const res = await http.get('/admin/users', { params: { page: 1, pageSize: 1 } });
    if (res?.total !== undefined) cards.value[0].value = String(res.total);
  } catch (err) {
    /* ignore */
  }
}

onMounted(async () => {
  await nextTick();
  initCharts();
  loadStats();
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
