<template>
  <div class="duty-dashboard" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="duty-topbar">
      <div class="duty-topbar__left">
        <div class="duty-topbar__title">舆情值班面板</div>
        <div class="duty-topbar__time">{{ currentTime }}</div>
        <el-tag :type="wsConnected ? 'success' : 'danger'" size="small">
          {{ wsConnected ? '实时' : '离线' }}
        </el-tag>
        <el-tooltip v-if="!wsConnected" content="点击重新连接" placement="bottom">
          <el-button size="small" type="warning" :icon="Refresh" @click="reconnect" :loading="reconnecting">重新连接</el-button>
        </el-tooltip>
      </div>
      <div class="duty-topbar__actions">
        <el-tag v-if="!wsConnected" type="warning" size="small">数据可能不是最新的，点击「重新连接」恢复实时更新</el-tag>
        <span class="duty-topbar__refresh" @click="loadData">{{ overview?.totalEvents ?? '—' }} 事件</span>
        <el-button size="small" :icon="FullScreen" text @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
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
import { ref, onMounted, onUnmounted } from 'vue';
import { FullScreen, Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import { io as socketIO } from 'socket.io-client';

const overview = ref<DutyOverview>({
  totalEvents: 0, alertCount: 0, criticalAlerts: 0,
  latestEvents: [], platformBreakdown: {}, sentimentTrend: { positive: 0, negative: 0, neutral: 0 },
  topKeywords: [],
});
const currentTime = ref('');
const isFullscreen = ref(false);
const wsConnected = ref(false);
const reconnecting = ref(false);

let socket: any = null;
let timeTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const feedRef = ref<HTMLElement>();

function connectSocket() {
  if (socket?.connected) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = localStorage.getItem('user_token') || '';

  socket = socketIO(`${protocol}//${host}`, {
    path: '/socket.io',
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    wsConnected.value = true;
    reconnecting.value = false;
  });

  socket.on('disconnect', () => {
    wsConnected.value = false;
  });

  socket.on('connect_error', () => {
    wsConnected.value = false;
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  wsConnected.value = false;
}

function reconnect() {
  reconnecting.value = true;
  disconnectSocket();
  connectSocket();
  // Also reload data immediately
  loadData();
  // Reset reconnecting state after timeout
  setTimeout(() => { reconnecting.value = false; }, 5000);
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
  connectSocket();
  loadData();
  updateTime();
  timeTimer = window.setInterval(updateTime, 1000);
  refreshTimer = window.setInterval(loadData, 30000);
});

onUnmounted(() => {
  disconnectSocket();
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
