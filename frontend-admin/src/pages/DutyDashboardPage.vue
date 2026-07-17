<template>
  <div class="duty-dashboard" :class="{ 'duty-dashboard--fullscreen': isFullscreen }">
    <div class="duty-topbar">
      <div class="duty-topbar__title">7x24 值班监控面板</div>
      <div class="duty-topbar__actions">
        <span class="duty-topbar__time">{{ currentTime }}</span>
        <el-tag :type="wsConnected ? 'success' : 'danger'" size="small">
          {{ wsConnected ? '实时' : '离线' }}
        </el-tag>
        <span class="duty-topbar__refresh" @click="loadData">
          刷新
        </span>
        <el-button size="small" @click="toggleFullscreen" circle>
          <template #icon><FullScreen /></template>
        </el-button>
      </div>
    </div>

    <div class="duty-alert-banner" v-if="overview.criticalAlerts > 0">
      <div class="duty-alert-banner__pulse"></div>
      <span class="duty-alert-banner__text">
        严重告警 {{ overview.criticalAlerts }} 条，请立即处理
      </span>
    </div>

    <div class="duty-kpi-row">
      <div class="duty-kpi">
        <div class="duty-kpi__value">{{ overview.totalEvents }}</div>
        <div class="duty-kpi__label">24h 事件数</div>
      </div>
      <div class="duty-kpi">
        <div class="duty-kpi__value">{{ overview.alertCount }}</div>
        <div class="duty-kpi__label">活跃告警</div>
      </div>
      <div class="duty-kpi duty-kpi--critical">
        <div class="duty-kpi__value">{{ overview.criticalAlerts }}</div>
        <div class="duty-kpi__label">严重告警</div>
      </div>
      <div class="duty-kpi">
        <div class="duty-kpi__value">{{ latestEventTime }}</div>
        <div class="duty-kpi__label">最新事件</div>
      </div>
    </div>

    <div class="duty-grid">
      <div class="duty-card duty-card--events">
        <div class="duty-card__title">实时事件流</div>
        <div class="duty-event-feed" ref="feedRef">
          <div
            v-for="evt in overview.latestEvents"
            :key="evt.id"
            class="duty-event-item"
            :class="'duty-event-item--' + evt.sentiment"
          >
            <span class="duty-event-item__sentiment">{{ sentimentIcon(evt.sentiment) }}</span>
            <span class="duty-event-item__platform">{{ evt.platform }}</span>
            <span class="duty-event-item__title">{{ evt.title }}</span>
            <span class="duty-event-item__time">{{ formatShort(evt.matchedAt) }}</span>
          </div>
          <el-empty v-if="overview.latestEvents.length === 0" description="暂无事件" />
        </div>
      </div>

      <div class="duty-card duty-card--platform">
        <div class="duty-card__title">平台分布</div>
        <div class="duty-platform-list">
          <div v-for="(count, platform) in overview.platformBreakdown" :key="platform" class="duty-platform-item">
            <span class="duty-platform-item__name">{{ platform }}</span>
            <div class="duty-platform-item__bar-bg">
              <div class="duty-platform-item__bar" :style="{ width: barWidth(count) }"></div>
            </div>
            <span class="duty-platform-item__count">{{ count }}</span>
          </div>
        </div>
      </div>

      <div class="duty-card duty-card--sentiment">
        <div class="duty-card__title">情感分布</div>
        <div class="duty-sentiment-grid">
          <div class="duty-sentiment-item duty-sentiment-item--positive">
            <div class="duty-sentiment-item__value">{{ overview.sentimentTrend.positive }}</div>
            <div class="duty-sentiment-item__label">正面</div>
          </div>
          <div class="duty-sentiment-item duty-sentiment-item--negative">
            <div class="duty-sentiment-item__value">{{ overview.sentimentTrend.negative }}</div>
            <div class="duty-sentiment-item__label">负面</div>
          </div>
          <div class="duty-sentiment-item duty-sentiment-item--neutral">
            <div class="duty-sentiment-item__value">{{ overview.sentimentTrend.neutral }}</div>
            <div class="duty-sentiment-item__label">中性</div>
          </div>
        </div>
      </div>

      <div class="duty-card duty-card--keywords">
        <div class="duty-card__title">热点关键词</div>
        <div class="duty-keywords">
          <el-tag v-for="kw in overview.topKeywords" :key="kw" class="duty-keyword" effect="dark">
            {{ kw }}
          </el-tag>
          <el-empty v-if="overview.topKeywords.length === 0" description="暂无关键词" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'DutyDashboardPage' });

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { FullScreen } from '@element-plus/icons-vue';
import http from '@/utils/http';

interface DutyOverview {
  totalEvents: number;
  alertCount: number;
  criticalAlerts: number;
  latestEvents: Array<{ id: number; title: string; platform: string; sentiment: string; matchedAt: Date }>;
  platformBreakdown: Record<string, number>;
  sentimentTrend: { positive: number; negative: number; neutral: number };
  topKeywords: string[];
}

const overview = ref<DutyOverview>({
  totalEvents: 0,
  alertCount: 0,
  criticalAlerts: 0,
  latestEvents: [],
  platformBreakdown: {},
  sentimentTrend: { positive: 0, negative: 0, neutral: 0 },
  topKeywords: [],
});

const isFullscreen = ref(false);
const currentTime = ref('');
const wsConnected = ref(false);
const feedRef = ref<HTMLElement>();
let timeTimer: number | undefined;
let refreshTimer: number | undefined;

function sentimentIcon(s: string): string {
  if (s === 'positive') return '+';
  if (s === 'negative') return '-';
  return '~';
}

const latestEventTime = computed(() => {
  if (overview.value.latestEvents.length === 0) return '--';
  const dt = new Date(overview.value.latestEvents[0].matchedAt);
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
});

function formatShort(d: Date | string): string {
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

function barWidth(count: number): string {
  const max = Math.max(...Object.values(overview.value.platformBreakdown), 1);
  return `${(count / max) * 100}%`;
}

async function loadData() {
  try {
    const data = await http.get('/duty/overview');
    overview.value = data as DutyOverview;
  } catch {
    // silent
  }
}

function updateTime() {
  const now = new Date();
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}

onMounted(() => {
  loadData();
  updateTime();
  timeTimer = window.setInterval(updateTime, 1000);
  refreshTimer = window.setInterval(loadData, 30000);
});

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.duty-dashboard {
  padding: 0;
  margin: -32px;
  min-height: calc(100vh - 80px);
  background: #0a0e1a;
  color: #e0e4f0;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  overflow-y: auto;
}

.duty-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: rgba(20, 25, 56, 0.8);
  border-bottom: 1px solid rgba(94, 114, 228, 0.2);
}

.duty-topbar__title {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #5E72E4, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.duty-topbar__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.duty-topbar__time {
  font-size: 18px;
  color: #8b95b0;
  letter-spacing: 2px;
}

.duty-topbar__refresh {
  cursor: pointer;
  color: #5E72E4;
  font-size: 13px;
}

.duty-topbar__refresh:hover {
  text-decoration: underline;
}

.duty-alert-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 32px;
  background: rgba(245, 54, 92, 0.15);
  border-bottom: 1px solid rgba(245, 54, 92, 0.3);
}

.duty-alert-banner__pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f5365c;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.duty-alert-banner__text {
  font-size: 16px;
  font-weight: 600;
  color: #f5365c;
}

.duty-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 24px 32px;
}

.duty-kpi {
  background: rgba(20, 25, 56, 0.6);
  border: 1px solid rgba(94, 114, 228, 0.15);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.duty-kpi__value {
  font-size: 42px;
  font-weight: 700;
  color: #5E72E4;
  line-height: 1.2;
}

.duty-kpi--critical .duty-kpi__value {
  color: #f5365c;
  animation: pulse 1.5s ease-in-out infinite;
}

.duty-kpi__label {
  font-size: 13px;
  color: #8b95b0;
  margin-top: 8px;
}

.duty-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  padding: 0 32px 32px;
}

.duty-card {
  background: rgba(20, 25, 56, 0.6);
  border: 1px solid rgba(94, 114, 228, 0.15);
  border-radius: 12px;
  padding: 20px;
}

.duty-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #8b95b0;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.duty-card--events {
  grid-row: span 2;
}

.duty-event-feed {
  max-height: 400px;
  overflow-y: auto;
}

.duty-event-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}

.duty-event-item:last-child {
  border-bottom: none;
}

.duty-event-item__sentiment {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.duty-event-item--positive .duty-event-item__sentiment {
  background: rgba(45, 206, 137, 0.2);
  color: #2dce89;
}

.duty-event-item--negative .duty-event-item__sentiment {
  background: rgba(245, 54, 92, 0.2);
  color: #f5365c;
}

.duty-event-item--neutral .duty-event-item__sentiment {
  background: rgba(94, 114, 228, 0.2);
  color: #5E72E4;
}

.duty-event-item__platform {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #8b95b0;
}

.duty-event-item__title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e0e4f0;
}

.duty-event-item__time {
  color: #8b95b0;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
}

.duty-platform-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.duty-platform-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.duty-platform-item__name {
  width: 80px;
  font-size: 13px;
  color: #e0e4f0;
}

.duty-platform-item__bar-bg {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.duty-platform-item__bar {
  height: 100%;
  background: linear-gradient(90deg, #5E72E4, #7C3AED);
  border-radius: 4px;
  transition: width 0.5s;
}

.duty-platform-item__count {
  width: 40px;
  text-align: right;
  font-size: 13px;
  color: #8b95b0;
}

.duty-sentiment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.duty-sentiment-item {
  text-align: center;
  padding: 16px;
  border-radius: 8px;
}

.duty-sentiment-item--positive {
  background: rgba(45, 206, 137, 0.1);
}

.duty-sentiment-item--negative {
  background: rgba(245, 54, 92, 0.1);
}

.duty-sentiment-item--neutral {
  background: rgba(94, 114, 228, 0.1);
}

.duty-sentiment-item__value {
  font-size: 32px;
  font-weight: 700;
}

.duty-sentiment-item--positive .duty-sentiment-item__value { color: #2dce89; }
.duty-sentiment-item--negative .duty-sentiment-item__value { color: #f5365c; }
.duty-sentiment-item--neutral .duty-sentiment-item__value { color: #5E72E4; }

.duty-sentiment-item__label {
  font-size: 12px;
  color: #8b95b0;
  margin-top: 4px;
}

.duty-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.duty-keyword {
  font-size: 12px;
}

@media (max-width: 1024px) {
  .duty-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .duty-grid {
    grid-template-columns: 1fr;
  }
}
</style>
