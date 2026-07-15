<template>
  <div class="short-video-page">
    <PageHeader title="短视频监控" subtitle="多平台短视频数据监控与分析">
      <template #actions>
        <div class="sv-controls">
          <el-select v-model="taskId" size="small" style="width: 180px" placeholder="选择监控任务" @change="fetchAll">
            <el-option v-for="t in tasks" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            size="small"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="fetchAll"
          />
          <el-button size="small" :icon="Refresh" :loading="loading" @click="fetchAll" />
        </div>
      </template>
    </PageHeader>

    <p class="page-guide">专项监控抖音、快手、小红书平台的短视频舆情</p>

    <div class="sv-stats">
        <StatCard label="短视频总数" :value="stats.totalVideos" icon="🎬" icon-bg="var(--gradient-primary)" :glow="'rgba(94, 114, 228, 0.4)'" />
        <StatCard label="总播放量" :value="formatNum(stats.totalPlays)" icon="▶️" icon-bg="var(--gradient-cool)" :glow="'rgba(6, 182, 212, 0.4)'" />
        <StatCard label="总点赞数" :value="formatNum(stats.totalLikes)" icon="❤️" icon-bg="var(--gradient-warm)" :glow="'rgba(245, 158, 11, 0.4)'" />
        <StatCard label="平均互动率" :value="stats.avgEngagementRate + '%'" icon="📈" icon-bg="linear-gradient(135deg, #10B981, #059669)" :glow="'rgba(16, 185, 129, 0.4)'" />
      </div>

      <div class="sv-platform-tabs">
        <el-radio-group v-model="platformFilter" size="small" @change="fetchVideos">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="douyin">抖音</el-radio-button>
          <el-radio-button value="kuaishou">快手</el-radio-button>
          <el-radio-button value="xiaohongshu">小红书</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="sentimentFilter" size="small" @change="fetchVideos" style="margin-left: 12px">
          <el-radio-button value="all">全部情感</el-radio-button>
          <el-radio-button value="positive">正面</el-radio-button>
          <el-radio-button value="neutral">中性</el-radio-button>
          <el-radio-button value="negative">负面</el-radio-button>
        </el-radio-group>
      </div>

      <div class="sv-grid">
        <div
          v-for="video in videos"
          :key="video.id"
          class="sv-card"
          :class="{ 'sv-card--expanded': expandedId === video.id }"
          @click="toggleExpand(video.id)"
        >
          <div class="sv-card__cover">
            <div class="sv-card__platform-badge" :class="`platform-badge--${video.platform}`">
              {{ platformLabel(video.platform) }}
            </div>
            <div class="sv-card__duration">{{ video.durationSeconds }}s</div>
            <div class="sv-card__cover-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
          </div>
          <div class="sv-card__body">
            <div class="sv-card__title">{{ video.title }}</div>
            <div class="sv-card__meta">
              <span class="sv-card__author">{{ video.author }}</span>
              <span class="sv-card__date">{{ formatDate(video.publishedAt) }}</span>
            </div>
            <div class="sv-card__metrics">
              <span class="sv-card__metric" title="播放量">▶ {{ formatNum(video.playCount) }}</span>
              <span class="sv-card__metric" title="点赞">❤ {{ formatNum(video.likeCount) }}</span>
              <span class="sv-card__metric" title="评论">💬 {{ formatNum(video.commentCount) }}</span>
              <span class="sv-card__metric" title="分享">↗ {{ formatNum(video.shareCount) }}</span>
            </div>
            <div class="sv-card__footer">
              <SentimentBadge :type="video.sentiment as 'positive' | 'negative' | 'neutral'" />
              <div class="sv-card__hashtags">
                <span v-for="tag in parseHashtags(video.hashtags)" :key="tag" class="sv-card__hashtag">{{ tag }}</span>
              </div>
            </div>
          </div>
          <div v-if="expandedId === video.id" class="sv-card__comments">
            <div class="sv-card__comments-title">评论 ({{ video.commentCount }})</div>
            <div v-for="(c, idx) in parseComments(video.comments)" :key="idx" class="sv-card__comment">
              <span class="sv-card__comment-user">{{ c.user }}</span>
              <span class="sv-card__comment-text">{{ c.content }}</span>
              <span class="sv-card__comment-likes">❤ {{ c.likes }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="total > pageSize" class="sv-pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          small
          @current-change="fetchVideos"
        />
      </div>

      <div class="sv-charts">
        <GlassCard title="平台对比" icon="📊" subtitle="各平台视频数与平均互动率" class="sv-chart-item">
          <div ref="platformChartRef" style="height: 300px" />
        </GlassCard>
        <GlassCard title="情感分布" icon="🎭" subtitle="短视频情感倾向占比" class="sv-chart-item">
          <div ref="sentimentChartRef" style="height: 300px" />
        </GlassCard>
        <GlassCard title="发布时间趋势" icon="📈" subtitle="视频发布数量时间分布" class="sv-chart-item">
          <div ref="trendChartRef" style="height: 300px" />
        </GlassCard>
      </div>

      <GlassCard v-if="hashtags.length" title="热门标签" icon="#️⃣" subtitle="按出现频率排序">
        <div class="sv-hashtag-cloud">
          <span
            v-for="h in hashtags"
            :key="h.tag"
            class="sv-hashtag-cloud__item"
            :style="{ fontSize: calcTagSize(h.count) + 'px', opacity: calcTagOpacity(h.count) }"
          >#{{ h.tag }}</span>
        </div>
      </GlassCard>
    </template>

    <EmptyStateGuide
      v-else-if="!loading"
      icon="🎬"
      title="暂无短视频数据"
      description="请先创建监控任务并包含短视频平台（抖音/快手/小红书），即可在此查看短视频舆情"
      primary-action="前往创建监控任务"
      @primary="router.push('/tasks')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import http from '@/utils/http';
import { Refresh } from '@element-plus/icons-vue';
import PageHeader from '@shared/components/PageHeader.vue';
import StatCard from '@shared/components/StatCard.vue';
import GlassCard from '@shared/components/GlassCard.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';
import EmptyStateGuide from '@/components/EmptyStateGuide.vue';

interface Task { id: number; name: string }
interface VideoStats {
  totalVideos: number; totalPlays: number; totalLikes: number;
  totalComments: number; totalShares: number; avgEngagementRate: number;
  byPlatform: Array<{ platform: string; count: number; avgEngagement: number }>;
  bySentiment: Array<{ sentiment: string; count: number }>;
}
interface Video { id: number; title: string; author: string; platform: string; durationSeconds: number; playCount: number; likeCount: number; commentCount: number; shareCount: number; sentiment: string; hashtags: string; comments: string; publishedAt: string; }
interface Hashtag { tag: string; count: number }

const tasks = ref<Task[]>([]);
const taskId = ref<number | undefined>();
const loading = ref(false);
const router = useRouter();
const videos = ref<Video[]>([]);
const stats = ref<VideoStats | null>(null);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const platformFilter = ref('all');
const sentimentFilter = ref('all');
const dateRange = ref<[string, string] | null>(null);
const expandedId = ref<number | null>(null);
const hashtags = ref<Hashtag[]>([]);

const platformChartRef = ref<HTMLElement>();
const sentimentChartRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLElement>();
let platformChart: echarts.ECharts | null = null;
let sentimentChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('zh-CN');
}

function platformLabel(p: string): string {
  return { douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书' }[p] || p;
}

function parseHashtags(h: string): string[] {
  if (!h) return [];
  try { return JSON.parse(h) as string[]; } catch { return []; }
}

function parseComments(c: string): Array<{ user: string; content: string; likes: number }> {
  if (!c) return [];
  try { return JSON.parse(c) as Array<{ user: string; content: string; likes: number }>; } catch { return []; }
}

function calcTagSize(count: number): number {
  const max = Math.max(...hashtags.value.map(h => h.count), 1);
  return 12 + (count / max) * 20;
}

function calcTagOpacity(count: number): number {
  const max = Math.max(...hashtags.value.map(h => h.count), 1);
  return 0.5 + (count / max) * 0.5;
}

function toggleExpand(id: number): void {
  expandedId.value = expandedId.value === id ? null : id;
}

async function fetchTasks(): Promise<void> {
  try {
    const data = await http.get('/monitor-tasks') as Task[];
    tasks.value = data;
    if (data.length > 0 && !taskId.value) {
      taskId.value = data[0].id;
    }
  } catch { /* ignore */ }
}

async function fetchStats(): Promise<void> {
  if (!taskId.value) return;
  stats.value = await http.get(`/short-videos/${taskId.value}/stats`) as VideoStats;
}

async function fetchVideos(): Promise<void> {
  if (!taskId.value) return;
  const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
  if (platformFilter.value !== 'all') params.platform = platformFilter.value;
  if (sentimentFilter.value !== 'all') params.sentiment = sentimentFilter.value;
  if (dateRange.value) {
    params.dateFrom = dateRange.value[0];
    params.dateTo = dateRange.value[1];
  }
  const res = await http.get(`/short-videos/${taskId.value}`, { params }) as { items: Video[]; total: number };
  videos.value = res.items;
  total.value = res.total;
}

async function fetchHashtags(): Promise<void> {
  if (!taskId.value) return;
  try {
    hashtags.value = await http.get(`/short-videos/${taskId.value}/hashtags`) as Hashtag[];
  } catch { hashtags.value = []; }
}

async function fetchAll(): Promise<void> {
  if (!taskId.value) return;
  loading.value = true;
  page.value = 1;
  await Promise.all([fetchStats(), fetchVideos(), fetchHashtags()]);
  loading.value = false;
  await nextTick();
  renderCharts();
}

function renderCharts(): void {
  if (!stats.value) return;

  if (platformChartRef.value && stats.value.byPlatform.length) {
    platformChart = echarts.getInstanceByDom(platformChartRef.value) || echarts.init(platformChartRef.value);
    platformChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['视频数', '平均互动率(%)'], textStyle: { color: '#94A3B8' } },
      xAxis: { type: 'category', data: stats.value.byPlatform.map(p => platformLabel(p.platform)), axisLabel: { color: '#94A3B8' } },
      yAxis: [
        { type: 'value', name: '视频数', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
        { type: 'value', name: '互动率(%)', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
      ],
      series: [
        { name: '视频数', type: 'bar', data: stats.value.byPlatform.map(p => p.count), itemStyle: { color: '#5E72E4', borderRadius: [4, 4, 0, 0] } },
        { name: '平均互动率(%)', type: 'line', yAxisIndex: 1, data: stats.value.byPlatform.map(p => p.avgEngagement), lineStyle: { color: '#10B981' }, itemStyle: { color: '#10B981' } },
      ],
      grid: { left: 60, right: 60, bottom: 30, top: 40 },
    }, true);
  }

  if (sentimentChartRef.value && stats.value.bySentiment.length) {
    sentimentChart = echarts.getInstanceByDom(sentimentChartRef.value) || echarts.init(sentimentChartRef.value);
    const colorMap: Record<string, string> = { positive: '#34D399', negative: '#F87171', neutral: '#94A3B8' };
    sentimentChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data: stats.value.bySentiment.map(s => ({
          name: s.sentiment === 'positive' ? '正面' : s.sentiment === 'negative' ? '负面' : '中性',
          value: s.count,
          itemStyle: { color: colorMap[s.sentiment] || '#94A3B8' },
        })),
        label: { color: '#CBD5E1', fontSize: 12 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
      }],
    }, true);
  }

  if (trendChartRef.value && videos.value.length) {
    trendChart = echarts.getInstanceByDom(trendChartRef.value) || echarts.init(trendChartRef.value);
    const dateMap = new Map<string, number>();
    videos.value.forEach(v => {
      const d = v.publishedAt.substring(0, 10);
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    });
    const sorted = Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    trendChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: sorted.map(([d]) => d), axisLabel: { color: '#94A3B8', rotate: 30 } },
      yAxis: { type: 'value', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
      series: [{
        type: 'line', smooth: true, data: sorted.map(([, c]) => c),
        lineStyle: { color: '#5E72E4', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(94,114,228,0.3)' }, { offset: 1, color: 'rgba(94,114,228,0.05)' }]) },
        itemStyle: { color: '#5E72E4' },
      }],
      grid: { left: 50, right: 20, bottom: 50, top: 20 },
    }, true);
  }
}

watch(taskId, () => { fetchAll(); });

onMounted(() => {
  fetchTasks();
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
.short-video-page { animation: fade-in 250ms ease-out both; }
.sv-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
.sv-platform-tabs { margin-bottom: 20px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; margin-bottom: 20px; }
.sv-card {
  background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
  overflow: hidden; cursor: pointer; transition: all var(--transition-normal);
  animation: fade-in 250ms ease-out both;
}
.sv-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }
.sv-card--expanded { grid-column: 1 / -1; }
.sv-card__cover {
  position: relative; height: 140px; background: linear-gradient(135deg, rgba(94,114,228,0.2), rgba(124,58,237,0.2));
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.sv-card__cover-placeholder { color: var(--text-tertiary); }
.sv-card__platform-badge {
  position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: 8px;
  font-size: 11px; font-weight: 600; color: #fff;
}
.platform-badge--douyin { background: #EF4444; }
.platform-badge--kuaishou { background: #F59E0B; }
.platform-badge--xiaohongshu { background: #EC4899; }
.sv-card__duration { position: absolute; bottom: 8px; right: 8px; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; }
.sv-card__body { padding: 14px; }
.sv-card__title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sv-card__meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sv-card__author { font-size: 12px; color: var(--text-secondary); }
.sv-card__date { font-size: 11px; color: var(--text-tertiary); }
.sv-card__metrics { display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.sv-card__metric { font-size: 12px; color: var(--text-secondary); }
.sv-card__footer { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sv-card__hashtags { display: flex; gap: 4px; flex-wrap: wrap; }
.sv-card__hashtag { font-size: 11px; color: var(--color-primary-light); background: rgba(94,114,228,0.1); padding: 1px 6px; border-radius: 4px; }
.sv-card__comments { padding: 14px; border-top: 1px solid var(--border-subtle); }
.sv-card__comments-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.sv-card__comment { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; font-size: 12px; }
.sv-card__comment-user { color: var(--color-primary-light); font-weight: 500; white-space: nowrap; }
.sv-card__comment-text { color: var(--text-secondary); flex: 1; }
.sv-card__comment-likes { color: var(--text-tertiary); font-size: 11px; white-space: nowrap; }
.sv-pagination { display: flex; justify-content: center; margin-bottom: 24px; }
.sv-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 20px; }
.sv-chart-item { min-width: 0; }
.sv-hashtag-cloud { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 8px 0; align-items: center; }
.sv-hashtag-cloud__item { color: var(--color-primary-light); cursor: pointer; transition: all var(--transition-fast); }
.sv-hashtag-cloud__item:hover { color: var(--color-primary); transform: scale(1.1); }
</style>
