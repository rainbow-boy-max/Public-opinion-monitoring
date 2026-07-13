<template>
  <div class="rt-screen">
    <!-- 顶部指标条 -->
    <header class="rt-header">
      <div class="rt-header__brand">
        <div class="rt-header__pulse" />
        <div class="rt-header__title">
          <div class="rt-header__title-main">实时舆情监测中心</div>
          <div class="rt-header__title-sub">Real-time Public Opinion Monitoring</div>
        </div>
      </div>
      <div class="rt-header__time">{{ currentTime }}</div>
      <div class="rt-header__status">
        <span class="rt-header__status-dot" :class="{ 'is-active': wsConnected }" />
        {{ wsConnected ? '已连接' : '连接中...' }}
      </div>
    </header>

    <!-- 核心指标卡 -->
    <section class="rt-stats">
      <div v-for="card in summaryCards" :key="card.label" class="rt-stat-card" :style="{ '--card-color': card.color }">
        <div class="rt-stat-card__bg" />
        <div class="rt-stat-card__label">{{ card.label }}</div>
        <div class="rt-stat-card__value">
          <span class="rt-stat-card__num">{{ card.value }}</span>
          <span v-if="card.unit" class="rt-stat-card__unit">{{ card.unit }}</span>
        </div>
        <div class="rt-stat-card__trend">{{ card.trend }}</div>
      </div>
    </section>

    <!-- 图表区 -->
    <section class="rt-charts">
      <div class="rt-chart-block">
        <div class="rt-chart-title">
          <span class="rt-chart-bar" />各平台舆情占比
        </div>
        <div ref="platformChartEl" class="rt-chart-canvas" style="height: 260px" />
      </div>
      <div class="rt-chart-block">
        <div class="rt-chart-title">
          <span class="rt-chart-bar" />情感倾向分布
        </div>
        <div ref="sentimentChartEl" class="rt-chart-canvas" style="height: 260px" />
      </div>
      <div class="rt-chart-block">
        <div class="rt-chart-title">
          <span class="rt-chart-bar" />24 小时趋势
        </div>
        <div ref="trendChartEl" class="rt-chart-canvas" style="height: 260px" />
      </div>
    </section>

    <!-- 实时事件流 -->
    <section class="rt-events-block">
      <div class="rt-chart-title">
        <span class="rt-chart-bar" />实时事件流
        <span class="rt-events-count">{{ events.length }} 条</span>
      </div>
      <div class="rt-events-stream">
        <transition-group name="slide-up">
          <article
            v-for="event in events.slice(0, 12)"
            :key="event.id || event.publishedAt || Math.random()"
            class="rt-event-card"
            :class="`rt-event-card--${event.sentiment || 'neutral'}`"
          >
            <div class="rt-event-card__head">
              <PlatformTag :platform="event.platform || 'test'" :label="event.platform || 'test'" />
              <SentimentBadge :type="(event.sentiment || 'neutral') as 'positive' | 'negative' | 'neutral'" />
              <span class="rt-event-card__time">{{ formatTime(event.matchedAt || event.publishedAt) }}</span>
            </div>
            <a :href="event.url" target="_blank" class="rt-event-card__title">
              {{ event.title }}
            </a>
            <div class="rt-event-card__meta">
              <span>{{ event.author }}</span>
              <span class="meta-sep">·</span>
              <span>阅读 {{ event.readCount || 0 }}</span>
              <span class="meta-sep">·</span>
              <span>点赞 {{ event.likeCount || 0 }}</span>
            </div>
          </article>
        </transition-group>
        <div v-if="events.length === 0" class="rt-events-empty">
          <div class="rt-events-empty__icon">📡</div>
          <div>等待事件接入...</div>
          <div class="rt-events-empty__sub">
            创建监控任务并绑定 Webhook，或通过 webhook-ingest 推送数据
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { io, Socket } from 'socket.io-client';
import * as echarts from 'echarts';
import http from '@/utils/http';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

interface EventRow {
  id: number;
  platform: string;
  title: string;
  url: string;
  readCount: number;
  likeCount: number;
  sentiment: string;
  matchedAt?: string;
  publishedAt?: string;
  author: string;
}

const events = ref<EventRow[]>([]);
const wsConnected = ref(false);
const platformChartEl = ref<HTMLElement>();
const sentimentChartEl = ref<HTMLElement>();
const trendChartEl = ref<HTMLElement>();
let platformChart: echarts.ECharts | null = null;
let sentimentChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;
let socket: Socket | null = null;
let clockTimer: number | null = null;

const currentTime = ref('');
const summaryCards = reactive([
  { label: '总舆情数', value: '0', unit: '', color: '#5E72E4', trend: '▲ 12.5%' },
  { label: '今日新增', value: '0', unit: '', color: '#7C3AED', trend: '▲ 8.3%' },
  { label: '活跃平台', value: '0', unit: '', color: '#10B981', trend: '▲ 4.2%' },
  { label: '负面占比', value: '0%', unit: '', color: '#EF4444', trend: '▼ 2.1%' },
]);

function updateTime(): void {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  currentTime.value = `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function formatTime(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function fetchMyTaskIds(): Promise<number[]> {
  try {
    const tasks = await http.get('/monitor-tasks');
    return (tasks || []).map((t: any) => t.id);
  } catch {
    return [];
  }
}

function initCharts(): void {
  if (platformChartEl.value) {
    platformChart = echarts.init(platformChartEl.value);
    platformChart.setOption(buildPlatformOption({}));
  }
  if (sentimentChartEl.value) {
    sentimentChart = echarts.init(sentimentChartEl.value);
    sentimentChart.setOption(buildSentimentOption({}));
  }
  if (trendChartEl.value) {
    trendChart = echarts.init(trendChartEl.value);
    trendChart.setOption(buildTrendOption([]));
  }
}

function buildPlatformOption(stats: any): any {
  const data = stats.byPlatform && Object.keys(stats.byPlatform).length
    ? Object.entries(stats.byPlatform).map(([name, value]) => ({ name, value }))
    : [
      { name: '微博', value: 0 },
      { name: '微信', value: 0 },
      { name: '抖音', value: 0 },
      { name: '小红书', value: 0 },
      { name: '快手', value: 0 },
      { name: '百家号', value: 0 },
    ];
  const colors = ['#FF5C5C', '#10B981', '#EF4444', '#EC4899', '#F59E0B', '#3B82F6'];
  return {
    backgroundColor: 'transparent',
    color: colors,
    tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { bottom: 0, textStyle: { color: '#9DA8E5' }, itemWidth: 8, itemHeight: 8 },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '45%'],
      data,
      itemStyle: { borderRadius: 6, borderColor: 'rgba(20,25,56,0.6)', borderWidth: 2 },
      label: { color: '#E8EBFF', fontSize: 12 },
    }],
  };
}

function buildSentimentOption(stats: any): any {
  const s = stats.bySentiment || { positive: 0, negative: 0, neutral: 0 };
  return {
    backgroundColor: 'transparent',
    color: ['#10B981', '#EF4444', '#94A3B8'],
    tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { bottom: 0, textStyle: { color: '#9DA8E5' }, itemWidth: 8, itemHeight: 8 },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '45%'],
      data: [
        { name: '正面', value: s.positive || 0 },
        { name: '负面', value: s.negative || 0 },
        { name: '中性', value: s.neutral || 0 },
      ],
      itemStyle: { borderRadius: 6, borderColor: 'rgba(20,25,56,0.6)', borderWidth: 2 },
      label: { color: '#E8EBFF', fontSize: 12 },
    }],
  };
}

function buildTrendOption(hourly: number[]): any {
  const data = (hourly && hourly.length === 24) ? hourly : new Array(24).fill(0);
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    grid: { left: 36, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
    },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [{
      type: 'bar',
      data,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#7C3AED' },
          { offset: 1, color: '#5E72E4' },
        ]),
      },
    }],
  };
}

function handleStats(stats: any): void {
  summaryCards[0].value = String(stats.total || 0);
  const today = stats.byPlatform ? Object.values(stats.byPlatform).reduce((a: any, b: any) => Number(a) + Number(b), 0) : 0;
  summaryCards[1].value = String(today);
  summaryCards[2].value = String(stats.byPlatform ? Object.keys(stats.byPlatform).length : 0);
  const total = (stats.bySentiment?.positive || 0) + (stats.bySentiment?.negative || 0) + (stats.bySentiment?.neutral || 0);
  const neg = stats.bySentiment?.negative || 0;
  summaryCards[3].value = total > 0 ? `${Math.round((neg / total) * 100)}%` : '0%';

  if (platformChart) platformChart.setOption(buildPlatformOption(stats));
  if (sentimentChart) sentimentChart.setOption(buildSentimentOption(stats));
  if (trendChart) trendChart.setOption(buildTrendOption(stats.hourlyTrend || []));
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

  socket.on('opinion:new', (payload: any) => {
    if (events.value.length >= 50) events.value.pop();
    events.value.unshift(payload);
  });

  socket.on('opinion:stats', (stats: any) => {
    handleStats(stats);
  });
}

async function loadInitialEvents(): Promise<void> {
  try {
    const tasks = await http.get('/monitor-tasks');
    for (const task of tasks || []) {
      try {
        const res = await http.get(`/monitor-tasks/${task.id}/events`, {
          params: { page: 1, pageSize: 10 },
        });
        const mapped = (res.items || []).map((e: any) => ({
          id: e.id,
          platform: e.platform,
          title: e.title,
          url: e.url,
          readCount: e.readCount,
          likeCount: e.likeCount,
          sentiment: e.sentiment,
          matchedAt: e.matchedAt,
          author: e.author,
        }));
        events.value.push(...mapped);
      } catch {
        // ignore
      }
    }
    if (events.value.length > 50) {
      events.value = events.value.slice(0, 50);
    }
  } catch (err) {
    console.error(err);
  }
}

onMounted(async () => {
  await nextTick();
  initCharts();
  await connectSocket();
  await loadInitialEvents();
  updateTime();
  clockTimer = window.setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (socket) socket.disconnect();
  if (clockTimer) window.clearInterval(clockTimer);
  if (platformChart) platformChart.dispose();
  if (sentimentChart) sentimentChart.dispose();
  if (trendChart) trendChart.dispose();
});
</script>

<style scoped>
.rt-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rt-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
}

.rt-header__brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.rt-header__pulse {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 12px var(--color-success);
  animation: pulse-glow 2s ease-in-out infinite;
}

.rt-header__title-main {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.rt-header__title-sub {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 2px;
}

.rt-header__time {
  font-size: 16px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  color: var(--text-primary);
  letter-spacing: 2px;
  flex: 1;
  text-align: center;
}

.rt-header__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.rt-header__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-warning);
  box-shadow: 0 0 8px currentColor;
}

.rt-header__status-dot.is-active {
  background: var(--color-success);
  animation: pulse-glow 2s ease-in-out infinite;
}

.rt-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.rt-stat-card {
  position: relative;
  padding: 20px 24px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.rt-stat-card__bg {
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
  height: 100%;
  background: radial-gradient(circle at top right, var(--card-color) 0%, transparent 70%);
  opacity: 0.15;
  pointer-events: none;
}

.rt-stat-card__label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  position: relative;
}

.rt-stat-card__value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  position: relative;
}

.rt-stat-card__num {
  font-size: 36px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--card-color), #FFFFFF);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
  line-height: 1.1;
  filter: drop-shadow(0 0 12px var(--card-color));
}

.rt-stat-card__unit {
  font-size: 14px;
  color: var(--text-tertiary);
}

.rt-stat-card__trend {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-success);
  font-weight: 500;
  position: relative;
}

.rt-charts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.rt-chart-block {
  padding: 18px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  min-height: 320px;
}

.rt-chart-title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 12px;
}

.rt-chart-bar {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 14px;
  background: var(--gradient-primary);
  border-radius: 2px;
}

.rt-events-block {
  padding: 18px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.rt-events-count {
  margin-left: 12px;
  background: rgba(94, 114, 228, 0.18);
  color: #A78BFA;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.rt-events-stream {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px;
}

.rt-event-card {
  padding: 14px 16px;
  background: rgba(15, 19, 47, 0.5);
  border-left: 3px solid var(--color-primary);
  border-radius: 8px;
  transition: all 200ms ease;
}

.rt-event-card--positive { border-left-color: var(--color-success); }
.rt-event-card--negative { border-left-color: var(--color-danger); }
.rt-event-card--neutral { border-left-color: var(--color-info); }

.rt-event-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rt-event-card__time {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}

.rt-event-card__title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  text-decoration: none;
  background-image: linear-gradient(90deg, #A78BFA, #5E72E4);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.rt-event-card__title:hover {
  text-decoration: underline;
}

.rt-event-card__meta {
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.meta-sep {
  opacity: 0.5;
}

.rt-events-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 20px;
  color: var(--text-tertiary);
}

.rt-events-empty__icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.rt-events-empty__sub {
  font-size: 12px;
  margin-top: 8px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 300ms ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

@media (max-width: 1200px) {
  .rt-charts {
    grid-template-columns: 1fr;
  }
  .rt-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .rt-events-stream {
    grid-template-columns: 1fr;
  }
}
</style>
