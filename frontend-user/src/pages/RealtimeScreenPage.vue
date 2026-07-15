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

    <p class="page-guide">实时展示舆情数据，支持 Socket.IO 实时推送和自动刷新</p>

    <!-- 核心指标卡 -->
    <section class="rt-stats">
      <div v-for="card in summaryCards" :key="card.label" class="rt-stat-card" :style="{ '--card-color': card.color }">
        <div class="rt-stat-card__bg" />
        <div class="rt-stat-card__label">{{ card.label }}</div>
        <div class="rt-stat-card__value">
          <span class="rt-stat-card__num" :key="card.key">{{ card.value }}</span>
          <span v-if="card.unit" class="rt-stat-card__unit">{{ card.unit }}</span>
        </div>
        <div class="rt-stat-card__trend" :style="{ color: card.trendColor }">{{ card.trend }}</div>
      </div>
    </section>

    <!-- 图表区 -->
    <section class="rt-charts">
      <div class="rt-chart-block rt-chart-block--wide">
        <div class="rt-chart-title">
          <span class="rt-chart-bar" />情感趋势 (24h)
        </div>
        <div ref="sentimentTrendEl" class="rt-chart-canvas" style="height: 260px" />
      </div>
      <div class="rt-chart-block">
        <div class="rt-chart-title">
          <span class="rt-chart-bar" />各平台舆情占比
        </div>
        <div ref="platformChartEl" class="rt-chart-canvas" style="height: 260px" />
      </div>
    </section>

    <section class="rt-keywords" v-if="keywords.length > 0">
      <div class="rt-chart-title">
        <span class="rt-chart-bar" />热门关键词
      </div>
      <div class="rt-keywords__tags">
        <span
          v-for="kw in keywords"
          :key="kw.keyword"
          class="rt-keyword-tag"
          :style="{ '--kw-color': kw.color, '--kw-size': kw.size }"
        >
          {{ kw.keyword }}
          <sup class="rt-keyword-tag__count">{{ kw.count }}</sup>
        </span>
      </div>
    </section>

    <!-- 实时事件流 -->
    <section class="rt-events-block">
      <div class="rt-chart-title">
        <span class="rt-chart-bar" />实时事件流
        <span class="rt-events-count">{{ events.length }} 条</span>
        <span style="flex: 1"></span>
        <el-tag v-if="demoMode" size="small" type="warning" effect="dark" style="margin-right: 8px">演示模式</el-tag>
        <el-button
          size="small"
          type="warning"
          :disabled="!firstEventId"
          @click="onGeneratePR"
        >
          🎯 生成公关方案
        </el-button>
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { ElMessage } from 'element-plus';
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
const keywords = ref<Array<{ keyword: string; count: number; color: string; size: string }>>([]);
const demoMode = ref(false);
const router = useRouter();

const firstEventId = computed(() => (events.value.length > 0 ? events.value[0].id : null));

async function onGeneratePR(): Promise<void> {
  const evt = events.value[0];
  if (!evt?.id) return;
  try {
    const res = await http.post('/pr/analyze', { eventId: evt.id });
    ElMessage.success('已生成公关方案，正在跳转...');
    setTimeout(() => router.push('/pr'), 800);
  } catch (err: any) {
    ElMessage.error(err?.message || '提交失败');
  }
}
const wsConnected = ref(false);
const platformChartEl = ref<HTMLElement>();
const sentimentTrendEl = ref<HTMLElement>();
let platformChart: echarts.ECharts | null = null;
let sentimentTrendChart: echarts.ECharts | null = null;
let socket: Socket | null = null;
let clockTimer: number | null = null;

const currentTime = ref('');
const summaryCards = reactive([
  { label: '总舆情数', value: '0', unit: '', color: '#5E72E4', trend: '实时总量', trendColor: '#9DA8E5', key: 'total' },
  { label: '正面', value: '0', unit: '', color: '#10B981', trend: '', trendColor: '#10B981', key: 'positive' },
  { label: '负面', value: '0', unit: '', color: '#EF4444', trend: '', trendColor: '#EF4444', key: 'negative' },
  { label: '中性', value: '0', unit: '', color: '#94A3B8', trend: '', trendColor: '#94A3B8', key: 'neutral' },
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
  if (sentimentTrendEl.value) {
    sentimentTrendChart = echarts.init(sentimentTrendEl.value);
    sentimentTrendChart.setOption(buildSentimentTrendOption([]));
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

function buildSentimentTrendOption(sentimentTrend: any): any {
  const trendData = sentimentTrend && sentimentTrend.length === 24 ? sentimentTrend : [];
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    legend: {
      data: ['正面', '负面', '中性'],
      textStyle: { color: '#9DA8E5' },
      itemWidth: 8,
      itemHeight: 8,
      bottom: 0,
    },
    grid: { left: 36, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,25,56,0.95)',
      borderColor: 'rgba(94,114,228,0.3)',
      textStyle: { color: '#E8EBFF' },
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } },
    },
    series: [
      {
        name: '正面',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: trendData.map((h: any) => h.positive),
        lineStyle: { width: 2, color: '#10B981' },
        itemStyle: { color: '#10B981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.3)' },
            { offset: 1, color: 'rgba(16,185,129,0.02)' },
          ]),
        },
      },
      {
        name: '负面',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: trendData.map((h: any) => h.negative),
        lineStyle: { width: 2, color: '#EF4444' },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.3)' },
            { offset: 1, color: 'rgba(239,68,68,0.02)' },
          ]),
        },
      },
      {
        name: '中性',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        data: trendData.map((h: any) => h.neutral),
        lineStyle: { width: 2, color: '#94A3B8' },
        itemStyle: { color: '#94A3B8' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(148,163,184,0.2)' },
            { offset: 1, color: 'rgba(148,163,184,0.02)' },
          ]),
        },
      },
    ],
  };
}

function handleStats(stats: any): void {
  summaryCards[0].value = String(stats.total || 0);
  summaryCards[1].value = String(stats.bySentiment?.positive || 0);
  summaryCards[2].value = String(stats.bySentiment?.negative || 0);
  summaryCards[3].value = String(stats.bySentiment?.neutral || 0);

  if (platformChart) platformChart.setOption(buildPlatformOption(stats));

  if (sentimentTrendChart && stats.sentimentTrend) {
    sentimentTrendChart.setOption(buildSentimentTrendOption(stats.sentimentTrend));
  }

  if (stats.topKeywords && Array.isArray(stats.topKeywords)) {
    const colors = ['#5E72E4', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6'];
    const maxCount = stats.topKeywords.length > 0 ? Math.max(...stats.topKeywords.map((k: any) => k.count)) : 1;
    keywords.value = stats.topKeywords.map((k: { keyword: string; count: number }, i: number) => ({
      keyword: k.keyword,
      count: k.count,
      color: colors[i % colors.length],
      size: `${0.7 + (k.count / maxCount) * 0.5}rem`,
    }));
  }
}

async function connectSocket(): Promise<void> {
  const taskIds = await fetchMyTaskIds();
  const token = localStorage.getItem('user_token') || '';

  const connTimeout = setTimeout(() => {
    if (!wsConnected.value) {
      initMockData();
    }
  }, 5000);

  socket = io({
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    clearTimeout(connTimeout);
    wsConnected.value = true;
    if (taskIds.length > 0) {
      socket?.emit('subscribe:tasks', { taskIds });
    }
  });

  socket.on('disconnect', () => {
    wsConnected.value = false;
    if (!demoMode.value) {
      initMockData();
    }
  });

  socket.on('connect_error', () => {
    clearTimeout(connTimeout);
    if (!wsConnected.value && !demoMode.value) {
      initMockData();
    }
  });

  socket.on('opinion:new', (payload: any) => {
    if (events.value.length >= 50) events.value.pop();
    events.value.unshift(payload);
  });

  socket.on('opinion:stats', (stats: any) => {
    handleStats(stats);
  });
}

function initMockData(): void {
  if (demoMode.value) return;
  demoMode.value = true;
  wsConnected.value = false;

  const platforms = ['微博', '微信', '抖音', '小红书', '快手', '百家号'];
  const sentiments: ('positive' | 'negative' | 'neutral')[] = ['positive', 'negative', 'neutral'];
  const authors = ['财经观察', '科技前线', '社会热点', '用户小明', '大V评论', '每日资讯'];
  const mockKeywords = ['产品质量', '消费者权益', '行业新规', '科技变革', '市场监管', '品牌口碑', '数据分析', '政策利好', '社会责任', '行业趋势'];
  const titles = [
    '某品牌产品质量问题引发消费者担忧',
    '行业新规出台,市场反应积极',
    '企业CEO在高峰论坛发表重要讲话',
    '消费者投诉数量较上月增长明显',
    '新技术的应用带来行业变革',
    '市场监管部门开展专项整治行动',
    '知名机构发布行业分析报告',
    '社交媒体热议某事件最新进展',
    '多家企业联合发起行业自律倡议',
    '政策利好推动板块整体上涨',
  ];

  const mockEvents: EventRow[] = Array.from({ length: 20 }, (_, i) => ({
    id: Date.now() + i,
    platform: platforms[i % platforms.length],
    title: titles[i % titles.length],
    url: '#',
    readCount: Math.floor(Math.random() * 100000),
    likeCount: Math.floor(Math.random() * 5000),
    sentiment: sentiments[i % sentiments.length],
    matchedAt: new Date(Date.now() - i * 60000).toISOString(),
    author: authors[i % authors.length],
  }));
  events.value = mockEvents;

  const total = mockEvents.length;
  const byPlatform: Record<string, number> = {};
  const bySentiment = { positive: 0, negative: 0, neutral: 0 };
  for (const e of mockEvents) {
    byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
    bySentiment[e.sentiment as keyof typeof bySentiment] += 1;
  }
  const hourlyTrend = new Array(24).fill(0);
  const now = new Date().getHours();
  for (let i = 0; i < 24; i++) {
    hourlyTrend[(now - i + 24) % 24] = Math.floor(Math.random() * 15 + 3);
  }

  // sentimentTrend
  const sentimentTrend = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    positive: Math.floor(Math.random() * 8 + 1),
    negative: Math.floor(Math.random() * 5),
    neutral: Math.floor(Math.random() * 6 + 1),
  }));

  // topKeywords
  const topKeywords = mockKeywords.slice(0, Math.floor(Math.random() * 4 + 7)).map((kw) => ({
    keyword: kw,
    count: Math.floor(Math.random() * 20 + 3),
  }));
  topKeywords.sort((a, b) => b.count - a.count);

  handleStats({ total, byPlatform, bySentiment, hourlyTrend, sentimentTrend, topKeywords });
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
  if (sentimentTrendChart) sentimentTrendChart.dispose();
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

.rt-keywords__empty {
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 8px 0;
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
  animation: num-pop 0.5s ease-out;
}

@keyframes num-pop {
  0% {
    transform: scale(1.3);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 1200px) {
  .rt-charts {
    grid-template-columns: 1fr;
  }
  .rt-chart-block--wide {
    grid-column: span 1;
  }
  .rt-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .rt-events-stream {
    grid-template-columns: 1fr;
  }
}
</style>
