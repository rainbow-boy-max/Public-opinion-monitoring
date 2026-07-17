<template>
  <div class="dashboard-page">
    <p class="page-guide">查看全网舆情态势总览，了解声量趋势、情感分布和最新事件</p>
    <div class="dashboard-stats">
      <StatCard
        v-for="card in cards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :icon="card.icon"
        :icon-bg="card.bg"
        :glow="card.glow"
        :trend="card.trend"
        trend-label="本周"
        @click="card.onClick"
      />
    </div>

    <div class="dashboard-row">
      <GlassCard title="我的订阅统计" subtitle="舆情命中统计">
        <template #extra>
          <el-radio-group v-model="dashboardRange" size="small" @change="refreshDashboard">
            <el-radio-button :value="7">7天</el-radio-button>
            <el-radio-button :value="30">30天</el-radio-button>
            <el-radio-button :value="90">90天</el-radio-button>
            <el-radio-button :value="365">12个月</el-radio-button>
          </el-radio-group>
        </template>
        <div ref="trendChartEl" style="height: 280px" />
      </GlassCard>

      <GlassCard title="快速操作" icon="⚡" subtitle="常用入口">
        <div class="quick-actions">
          <button class="quick-action" @click="$router.push('/tasks')">
            <div class="quick-action__icon" style="background: var(--gradient-primary)">🎯</div>
            <div class="quick-action__text">
              <div class="quick-action__title">创建监控任务</div>
              <div class="quick-action__sub">订阅关键词</div>
            </div>
          </button>
          <button class="quick-action" @click="$router.push('/webhooks')">
            <div class="quick-action__icon" style="background: var(--gradient-cool)">🔔</div>
            <div class="quick-action__text">
              <div class="quick-action__title">配置 Webhook</div>
              <div class="quick-action__sub">告警推送</div>
            </div>
          </button>
          <button class="quick-action" @click="$router.push('/realtime')">
            <div class="quick-action__icon" style="background: var(--gradient-warm)">📊</div>
            <div class="quick-action__text">
              <div class="quick-action__title">打开实时大屏</div>
              <div class="quick-action__sub">可视化监控</div>
            </div>
          </button>
          <button class="quick-action" @click="$router.push('/pr')">
            <div class="quick-action__icon" style="background: linear-gradient(135deg, #7C3AED, #5E72E4)">🎯</div>
            <div class="quick-action__text">
              <div class="quick-action__title">AI 公关</div>
              <div class="quick-action__sub">智能危机应对</div>
            </div>
          </button>
        </div>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';

const router = useRouter();
const trendChartEl = ref<HTMLElement>();
const dashboardRange = ref(7);

const cards = ref([
  {
    label: '监控任务',
    value: '0',
    icon: '🎯',
    bg: 'var(--gradient-primary)',
    glow: 'rgba(94, 114, 228, 0.4)',
    trend: 12,
    onClick: () => router.push('/tasks'),
  },
  {
    label: 'Webhook 数量',
    value: '0',
    icon: '🔔',
    bg: 'var(--gradient-cool)',
    glow: 'rgba(6, 182, 212, 0.4)',
    trend: 8,
    onClick: () => router.push('/webhooks'),
  },
  {
    label: '今日新增舆情',
    value: '0',
    icon: '📊',
    bg: 'var(--gradient-warm)',
    glow: 'rgba(245, 158, 11, 0.4)',
    trend: 24,
    onClick: () => router.push('/realtime'),
  },
  {
    label: '活跃平台',
    value: '0',
    icon: '🌐',
    bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    glow: 'rgba(16, 185, 129, 0.4)',
    trend: 0,
    onClick: () => {},
  },
]);

async function load(): Promise<void> {
  try {
    const tasks = await http.get('/monitor-tasks');
    cards.value[0].value = String((tasks || []).length);
    const webhooks = await http.get('/webhooks');
    cards.value[1].value = String((webhooks || []).length);
  } catch (err) {
    console.error(err);
  }
  try {
    const tasks = await http.get('/monitor-tasks');
    const total = (tasks || []).reduce((sum, t) => sum + (t.eventCount || 0), 0);
    cards.value[2].value = String(total);
  } catch (err) {
    /* ignore */
  }
}

function refreshDashboard() {
  initChart();
  load();
}

function initChart(): void {
  if (!trendChartEl.value) return;
  const chart = echarts.init(trendChartEl.value);
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    grid: { left: 40, right: 16, top: 24, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
    },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [{
      type: 'line',
      smooth: true,
      data: [12, 28, 19, 36, 24, 42, 38],
      itemStyle: { color: '#5E72E4' },
      lineStyle: { width: 3, color: '#5E72E4' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(94, 114, 228, 0.4)' },
        { offset: 1, color: 'rgba(94, 114, 228, 0)' },
      ]) },
      symbol: 'circle',
      symbolSize: 8,
    }],
  });
}

onMounted(async () => {
  await nextTick();
  initChart();
  await load();
});
</script>

<style scoped>
.page-guide {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 16px;
  line-height: 1.5;
}
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

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  color: inherit;
  font-family: inherit;
}

.quick-action:hover {
  transform: translateX(4px);
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.12);
}

.quick-action__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.quick-action__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.quick-action__sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 1024px) {
  .dashboard-row {
    grid-template-columns: 1fr;
  }
}
</style>
