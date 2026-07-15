<template>
  <div class="timeline-page">
    <div class="timeline-controls">
      <div class="timeline-controls__left">
        <h2 class="timeline-page__title">事件脉络梳理</h2>
      </div>
      <div class="timeline-controls__right">
        <el-select
          v-model="selectedTaskId"
          placeholder="选择监控任务"
          size="small"
          style="width: 200px"
          @change="loadData"
        >
          <el-option
            v-for="t in tasks"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
        <el-select
          v-model="timeRange"
          placeholder="时间范围"
          size="small"
          style="width: 120px"
          @change="loadData"
        >
          <el-option label="24小时" :value="24" />
          <el-option label="48小时" :value="48" />
          <el-option label="7天" :value="168" />
        </el-select>
        <el-button size="small" @click="loadData">
          <template #icon><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></template>
          刷新
        </el-button>
      </div>
    </div>

    <p class="page-guide">按时间轴查看舆情事件的发展脉络和关键里程碑</p>

    <div v-if="loading" class="timeline-loading">
      <el-skeleton :rows="6" animated />
    </div>

    <template v-else-if="timelineData">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-card__icon" style="background: rgba(94, 114, 228, 0.15); color: #5E72E4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="summary-card__body">
            <div class="summary-card__value">{{ summary.totalEvents }}</div>
            <div class="summary-card__label">总事件数</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-card__icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="summary-card__body">
            <div class="summary-card__value">{{ formatHour(summary.peakHour) }}</div>
            <div class="summary-card__label">高峰时段</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-card__icon" :style="platformIconStyle(summary.dominantPlatform)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div class="summary-card__body">
            <div class="summary-card__value">{{ platformLabel(summary.dominantPlatform) }}</div>
            <div class="summary-card__label">主导平台</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-card__icon" :style="sentimentIconStyle(summary.overallSentiment)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </div>
          <div class="summary-card__body">
            <div class="summary-card__value">{{ sentimentLabel(summary.overallSentiment) }}</div>
            <div class="summary-card__label">整体情感</div>
          </div>
        </div>
      </div>

      <div class="timeline-content">
        <div class="timeline-chart-section">
          <GlassCard title="情感趋势" icon="◉" subtitle="时间轴上的情感变化">
            <div ref="sentimentChartEl" style="height: 260px" />
          </GlassCard>
        </div>

        <div class="timeline-list-section">
          <GlassCard title="事件时间线" icon="◉" subtitle="按时间分组的事件脉络">
            <div class="timeline-list">
              <div
                v-for="(entry, idx) in timelineData"
                :key="entry.time"
                class="timeline-item"
              >
                <div class="timeline-item__connector">
                  <div
                    class="timeline-item__dot"
                    :class="`timeline-item__dot--${dominantSentiment(entry)}`"
                  />
                  <div v-if="idx < timelineData.length - 1" class="timeline-item__line" />
                </div>
                <div
                  class="timeline-item__card"
                  :class="{ 'timeline-item__card--expanded': expandedIdx === idx }"
                  @click="toggleExpand(idx)"
                >
                  <div class="timeline-item__header">
                    <div class="timeline-item__time">{{ formatIntervalTime(entry.time) }}</div>
                    <div class="timeline-item__meta">
                      <span class="timeline-item__count">{{ entry.total }} 条</span>
                      <div class="timeline-item__platforms">
                        <span
                          v-for="(count, platform) in entry.byPlatform"
                          :key="platform"
                          class="timeline-item__platform"
                          :class="`platform-tag--${platform}`"
                        >
                          {{ platformLabel(platform) }}({{ count }})
                        </span>
                      </div>
                    </div>
                    <div class="timeline-item__sentiment-bar">
                      <div
                        class="timeline-item__sentiment-seg sentiment-bar--positive"
                        :style="{ width: sentimentPct(entry, 'positive') + '%' }"
                      />
                      <div
                        class="timeline-item__sentiment-seg sentiment-bar--neutral"
                        :style="{ width: sentimentPct(entry, 'neutral') + '%' }"
                      />
                      <div
                        class="timeline-item__sentiment-seg sentiment-bar--negative"
                        :style="{ width: sentimentPct(entry, 'negative') + '%' }"
                      />
                    </div>
                    <div v-if="entry.sentimentShift" class="timeline-item__shift">转折</div>
                    <div class="timeline-item__expand-icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                  <div v-if="expandedIdx === idx" class="timeline-item__detail">
                    <div class="timeline-item__keywords" v-if="entry.keywords.length">
                      <span class="detail-label">关键词:</span>
                      <el-tag
                        v-for="kw in entry.keywords"
                        :key="kw"
                        size="small"
                        class="keyword-tag"
                      >
                        {{ kw }}
                      </el-tag>
                    </div>
                    <div class="timeline-item__events">
                      <div
                        v-for="evt in entry.keyEvents"
                        :key="evt.id"
                        class="key-event-row"
                      >
                        <div class="key-event-row__title">{{ evt.title }}</div>
                        <div class="key-event-row__meta">
                          <PlatformTag :platform="evt.platform" :label="platformLabel(evt.platform)" />
                          <SentimentBadge :type="evt.sentiment as any" />
                          <span class="key-event-row__author">{{ evt.author }}</span>
                          <span class="key-event-row__engagement">互动 {{ formatNum(evt.engagement) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div class="timeline-milestones-section">
          <GlassCard title="关键节点" icon="◉" subtitle="事件发展的重要转折点">
            <div v-if="milestones.length === 0" class="empty-state">暂无数据</div>
            <div v-else class="milestones-list">
              <div
                v-for="m in milestones"
                :key="m.type"
                class="milestone-item"
              >
                <div class="milestone-item__header">
                  <div
                    class="milestone-item__badge"
                    :class="`milestone-item__badge--${m.type}`"
                  >
                    {{ milestoneIcon(m.type) }}
                  </div>
                  <div>
                    <div class="milestone-item__label">{{ m.label }}</div>
                    <div v-if="m.event" class="milestone-item__time">
                      {{ formatTime(m.event.publishTime) }}
                    </div>
                  </div>
                </div>
                <div v-if="m.event" class="milestone-item__body">
                  <div class="milestone-item__title">{{ m.event.title }}</div>
                  <div class="milestone-item__footer">
                    <PlatformTag :platform="m.event.platform" :label="platformLabel(m.event.platform)" />
                    <SentimentBadge :type="m.event.sentiment as any" />
                    <span class="milestone-item__engagement">互动 {{ formatNum(m.event.engagement) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(140,155,240,0.3)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <p>请选择一个监控任务查看事件脉络</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

interface KeyEvent {
  id: number;
  title: string;
  platform: string;
  author: string;
  sentiment: string;
  engagement: number;
}

interface TimelineEntry {
  time: string;
  total: number;
  byPlatform: Record<string, number>;
  bySentiment: { positive: number; negative: number; neutral: number };
  keywords: string[];
  keyEvents: KeyEvent[];
  sentimentShift: boolean;
}

interface TimelineSummary {
  totalEvents: number;
  peakHour: string;
  dominantPlatform: string;
  overallSentiment: string;
  keywords: string[];
}

interface Milestone {
  type: string;
  label: string;
  event: {
    id: number;
    title: string;
    platform: string;
    author: string;
    sentiment: string;
    engagement: number;
    publishTime: string;
  } | null;
}

const sentimentChartEl = ref<HTMLElement>();
const selectedTaskId = ref<number | undefined>(undefined);
const timeRange = ref<number>(24);
const tasks = ref<any[]>([]);
const timelineData = ref<TimelineEntry[]>([]);
const summary = ref<TimelineSummary>({
  totalEvents: 0, peakHour: '', dominantPlatform: '', overallSentiment: '', keywords: [],
});
const milestones = ref<Milestone[]>([]);
const loading = ref(false);
const expandedIdx = ref<number | null>(null);

const PLATFORM_LABELS: Record<string, string> = {
  weixin: '微信', weixin_video: '微信视频号', douyin: '抖音',
  xiaohongshu: '小红书', kuaishou: '快手', weibo: '微博', baijiahao: '百家号',
  webhook_ingest: 'API接入', test: '测试',
};

const PLATFORM_COLORS: Record<string, string> = {
  weixin: '#10B981', weixin_video: '#34D399', douyin: '#EF4444',
  xiaohongshu: '#EC4899', kuaishou: '#F59E0B', weibo: '#FF5C5C',
  baijiahao: '#3B82F6', webhook_ingest: '#8B5CF6', test: '#6B7280',
};

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] || p;
}

function sentimentLabel(s: string): string {
  return s === 'positive' ? '正面' : s === 'negative' ? '负面' : '中性';
}

function platformIconStyle(p: string): Record<string, string> {
  const c = PLATFORM_COLORS[p] || '#5E72E4';
  return { background: `${c}26`, color: c };
}

function sentimentIconStyle(s: string): Record<string, string> {
  const c = s === 'positive' ? '#34D399' : s === 'negative' ? '#F87171' : '#94A3B8';
  return { background: `${c}26`, color: c };
}

function formatHour(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function formatIntervalTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${h}:${m}`;
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function dominantSentiment(entry: TimelineEntry): string {
  const s = entry.bySentiment;
  if (s.positive > s.negative && s.positive > s.neutral) return 'positive';
  if (s.negative > s.positive && s.negative > s.neutral) return 'negative';
  return 'neutral';
}

function sentimentPct(entry: TimelineEntry, type: string): number {
  if (entry.total === 0) return 0;
  return (entry.bySentiment[type as keyof typeof entry.bySentiment] / entry.total) * 100;
}

function milestoneIcon(type: string): string {
  const icons: Record<string, string> = {
    first: '01', peak_engagement: '◉',
    most_negative: '◉', most_shared: '◉', peak_volume: '◉',
  };
  return icons[type] || '◉';
}

function toggleExpand(idx: number): void {
  expandedIdx.value = expandedIdx.value === idx ? null : idx;
}

async function loadTasks(): Promise<void> {
  try {
    const data = await http.get('/monitor-tasks');
    tasks.value = data || [];
    if (tasks.value.length > 0 && !selectedTaskId.value) {
      selectedTaskId.value = tasks.value[0].id;
      await loadData();
    }
  } catch { /* ignore */ }
}

async function loadData(): Promise<void> {
  if (!selectedTaskId.value) return;
  loading.value = true;
  expandedIdx.value = null;
  try {
    const [tl, ms] = await Promise.all([
      http.get(`/timeline/${selectedTaskId.value}`, {
        params: { hours: timeRange.value },
      }),
      http.get(`/timeline/${selectedTaskId.value}/milestones`),
    ]);
    timelineData.value = (tl as any)?.timeline || [];
    summary.value = (tl as any)?.summary || summary.value;
    milestones.value = (ms as any)?.milestones || [];
    await nextTick();
    initSentimentChart();
  } catch { /* empty mock fallback */ }
  finally { loading.value = false; }
}

function initSentimentChart(): void {
  if (!sentimentChartEl.value || timelineData.value.length === 0) return;
  const chart = echarts.init(sentimentChartEl.value);
  const sorted = [...timelineData.value].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
  const times = sorted.map((e) => formatIntervalTime(e.time));
  const positive = sorted.map((e) => e.bySentiment.positive);
  const negative = sorted.map((e) => e.bySentiment.negative);
  const neutral = sorted.map((e) => e.bySentiment.neutral);

  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    grid: { left: 40, right: 16, top: 24, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,25,56,0.95)',
      borderColor: 'rgba(94,114,228,0.3)',
      textStyle: { color: '#E8EBFF' },
    },
    legend: {
      data: ['正面', '中性', '负面'],
      textStyle: { color: '#9DA8E5', fontSize: 12 },
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      axisLabel: { color: '#9DA8E5', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } },
      axisLabel: { color: '#9DA8E5' },
    },
    series: [
      {
        name: '正面',
        type: 'line',
        smooth: true,
        data: positive,
        itemStyle: { color: '#34D399' },
        lineStyle: { width: 2, color: '#34D399' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(52, 211, 153, 0.35)' },
            { offset: 1, color: 'rgba(52, 211, 153, 0)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: '中性',
        type: 'line',
        smooth: true,
        data: neutral,
        itemStyle: { color: '#94A3B8' },
        lineStyle: { width: 2, color: '#94A3B8' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(148, 163, 184, 0.25)' },
            { offset: 1, color: 'rgba(148, 163, 184, 0)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: '负面',
        type: 'line',
        smooth: true,
        data: negative,
        itemStyle: { color: '#F87171' },
        lineStyle: { width: 2, color: '#F87171' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(248, 113, 113, 0.35)' },
            { offset: 1, color: 'rgba(248, 113, 113, 0)' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  });
}

onMounted(async () => {
  await loadTasks();
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
.timeline-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.timeline-page__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.timeline-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.timeline-controls__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-loading {
  padding: 40px;
  background: var(--glass-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.summary-card:hover {
  border-color: var(--border-medium);
  transform: translateY(-1px);
}

.summary-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-card__value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.summary-card__label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* Content grid */
.timeline-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.timeline-chart-section {
  grid-column: 1 / -1;
}

.timeline-list-section {
  grid-column: 1 / -1;
}

.timeline-milestones-section {
  grid-column: 1 / -1;
}

@media (min-width: 1200px) {
  .timeline-content {
    grid-template-columns: 1fr 340px;
  }
  .timeline-chart-section {
    grid-column: 1 / -1;
  }
  .timeline-list-section {
    grid-column: 1;
  }
  .timeline-milestones-section {
    grid-column: 2;
  }
}

/* Timeline List */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 0;
}

.timeline-item {
  display: flex;
  gap: 16px;
}

.timeline-item__connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
  padding-top: 18px;
}

.timeline-item__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid;
  background: var(--bg-primary);
  flex-shrink: 0;
  z-index: 1;
  transition: all var(--transition-fast);
}

.timeline-item__dot--positive {
  border-color: #34D399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
}

.timeline-item__dot--negative {
  border-color: #F87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.4);
}

.timeline-item__dot--neutral {
  border-color: #94A3B8;
  box-shadow: 0 0 8px rgba(148, 163, 184, 0.3);
}

.timeline-item__line {
  width: 2px;
  flex: 1;
  background: linear-gradient(to bottom, rgba(140, 155, 240, 0.2), rgba(140, 155, 240, 0.05));
  min-height: 20px;
}

.timeline-item__card {
  flex: 1;
  margin-bottom: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  overflow: hidden;
}

.timeline-item__card:hover {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.06);
}

.timeline-item__card--expanded {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.08);
}

.timeline-item__header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.timeline-item__time {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 48px;
  font-variant-numeric: tabular-nums;
}

.timeline-item__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.timeline-item__count {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.timeline-item__platforms {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.timeline-item__platform {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  background: rgba(94, 114, 228, 0.1);
  color: var(--text-tertiary);
}

.timeline-item__sentiment-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  min-width: 100px;
  max-width: 160px;
  background: rgba(140, 155, 240, 0.08);
}

.sentiment-bar--positive {
  background: #34D399;
  transition: width 0.3s ease;
}

.sentiment-bar--neutral {
  background: #94A3B8;
  transition: width 0.3s ease;
}

.sentiment-bar--negative {
  background: #F87171;
  transition: width 0.3s ease;
}

.timeline-item__shift {
  font-size: 11px;
  font-weight: 600;
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.15);
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
}

.timeline-item__expand-icon {
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.timeline-item__card--expanded .timeline-item__expand-icon {
  transform: rotate(180deg);
}

.timeline-item__detail {
  border-top: 1px solid var(--border-subtle);
  padding: 14px 18px;
}

.timeline-item__keywords {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.keyword-tag {
  --el-tag-bg-color: rgba(94, 114, 228, 0.12);
  --el-tag-border-color: rgba(94, 114, 228, 0.2);
  --el-tag-text-color: #A5B4FC;
}

.timeline-item__events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-event-row {
  padding: 10px 12px;
  background: rgba(15, 19, 47, 0.4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.key-event-row__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-event-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.key-event-row__author {
  font-size: 12px;
  color: var(--text-tertiary);
}

.key-event-row__engagement {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: auto;
}

/* Milestones */
.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.milestone-item {
  padding: 14px;
  background: rgba(15, 19, 47, 0.4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.milestone-item:hover {
  border-color: var(--border-medium);
}

.milestone-item__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.milestone-item__badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.milestone-item__badge--first {
  background: rgba(94, 114, 228, 0.15);
  color: #5E72E4;
}

.milestone-item__badge--peak_engagement {
  background: rgba(245, 158, 11, 0.15);
  color: #F59E0B;
}

.milestone-item__badge--most_negative {
  background: rgba(248, 113, 113, 0.15);
  color: #F87171;
}

.milestone-item__badge--most_shared {
  background: rgba(52, 211, 153, 0.15);
  color: #34D399;
}

.milestone-item__badge--peak_volume {
  background: rgba(139, 92, 246, 0.15);
  color: #8B5CF6;
}

.milestone-item__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.milestone-item__time {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.milestone-item__body {
  padding-left: 48px;
}

.milestone-item__title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.milestone-item__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.milestone-item__engagement {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>
