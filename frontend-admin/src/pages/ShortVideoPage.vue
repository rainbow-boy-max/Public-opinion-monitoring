<template>
  <div class="short-video-page">
    <PageHeader title="短视频监控管理" subtitle="全平台短视频数据总览与导出">
      <template #actions>
        <div class="sv-controls">
          <el-select v-model="userId" size="small" style="width: 160px" placeholder="选择用户" @change="fetchTasks">
            <el-option label="全部用户" value="" />
            <el-option v-for="u in users" :key="u.id" :label="u.username" :value="u.id" />
          </el-select>
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
          <el-button size="small" :icon="Download" @click="exportData">导出</el-button>
          <el-button size="small" :icon="Refresh" :loading="loading" @click="fetchAll" />
        </div>
      </template>
    </PageHeader>

    <template v-if="stats">
      <div class="sv-stats">
        <StatCard label="短视频总数" :value="stats.totalVideos" icon="🎬" icon-bg="var(--gradient-primary)" :glow="'rgba(94, 114, 228, 0.4)'" />
        <StatCard label="总播放量" :value="formatNum(stats.totalPlays)" icon="▶️" icon-bg="var(--gradient-cool)" :glow="'rgba(6, 182, 212, 0.4)'" />
        <StatCard label="总互动量" :value="formatNum(stats.totalLikes + stats.totalComments + stats.totalShares)" icon="📊" icon-bg="var(--gradient-warm)" :glow="'rgba(245, 158, 11, 0.4)'" />
        <StatCard label="平均互动率" :value="stats.avgEngagementRate + '%'" icon="📈" icon-bg="linear-gradient(135deg, #10B981, #059669)" :glow="'rgba(16, 185, 129, 0.4)'" />
      </div>

      <div class="sv-platform-tabs">
        <el-radio-group v-model="platformFilter" size="small" @change="fetchVideos">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="douyin">抖音</el-radio-button>
          <el-radio-button value="kuaishou">快手</el-radio-button>
          <el-radio-button value="xiaohongshu">小红书</el-radio-button>
        </el-radio-group>
        <el-input-number v-model="topLimit" :min="5" :max="50" size="small" style="width: 100px; margin-left: 12px" @change="fetchAll" />
      </div>

      <div class="sv-table-wrapper">
        <el-table :data="videos" v-loading="loading" stripe style="width: 100%" @row-click="toggleExpand">
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column prop="author" label="作者" width="120" />
          <el-table-column label="平台" width="90">
            <template #default="{ row }">
              <PlatformTag :platform="row.platform" :label="platformLabel(row.platform)" />
            </template>
          </el-table-column>
          <el-table-column label="播放" width="80" align="right">
            <template #default="{ row }">{{ formatNum(row.playCount) }}</template>
          </el-table-column>
          <el-table-column label="点赞" width="80" align="right">
            <template #default="{ row }">{{ formatNum(row.likeCount) }}</template>
          </el-table-column>
          <el-table-column label="评论" width="80" align="right">
            <template #default="{ row }">{{ formatNum(row.commentCount) }}</template>
          </el-table-column>
          <el-table-column label="分享" width="80" align="right">
            <template #default="{ row }">{{ formatNum(row.shareCount) }}</template>
          </el-table-column>
          <el-table-column label="情感" width="80">
            <template #default="{ row }">
              <SentimentBadge :type="row.sentiment as 'positive' | 'negative' | 'neutral'" />
            </template>
          </el-table-column>
          <el-table-column prop="publishedAt" label="发布时间" width="100">
            <template #default="{ row }">{{ formatDate(row.publishedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div class="sv-charts">
        <GlassCard title="平台对比" icon="📊" subtitle="视频数与平均互动率" class="sv-chart-item">
          <div ref="platformChartRef" style="height: 300px" />
        </GlassCard>
        <GlassCard title="情感分布" icon="🎭" subtitle="情感倾向占比" class="sv-chart-item">
          <div ref="sentimentChartRef" style="height: 300px" />
        </GlassCard>
        <GlassCard title="标签云" icon="#️⃣" subtitle="热门标签" class="sv-chart-item">
          <div class="sv-hashtag-cloud" style="padding: 16px">
            <span v-for="h in hashtags" :key="h.tag" class="sv-hashtag-cloud__item"
              :style="{ fontSize: calcTagSize(h.count) + 'px', opacity: calcTagOpacity(h.count) }"
            >#{{ h.tag }}</span>
          </div>
        </GlassCard>
      </div>

      <div v-if="expandedVideo" class="sv-expanded">
        <GlassCard :title="'评论列表 - ' + expandedVideo.title" icon="💬" subtitle="模拟评论数据">
          <div v-for="(c, idx) in parseComments(expandedVideo.comments)" :key="idx" class="sv-comment-row">
            <el-avatar :size="24">{{ c.user.charAt(0) }}</el-avatar>
            <div class="sv-comment-row__body">
              <div class="sv-comment-row__user">{{ c.user }}</div>
              <div class="sv-comment-row__text">{{ c.content }}</div>
            </div>
            <span class="sv-comment-row__likes">❤ {{ c.likes }}</span>
          </div>
          <el-empty v-if="!expandedVideo.comments || parseComments(expandedVideo.comments).length === 0" description="暂无评论" />
        </GlassCard>
      </div>
    </template>

    <el-empty v-else-if="!loading" description="请选择用户和监控任务" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import { Refresh, Download } from '@element-plus/icons-vue';
import PageHeader from '@shared/components/PageHeader.vue';
import StatCard from '@shared/components/StatCard.vue';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

interface User { id: number; username: string }
interface Task { id: number; name: string }
interface VideoStats {
  totalVideos: number; totalPlays: number; totalLikes: number;
  totalComments: number; totalShares: number; avgEngagementRate: number;
  byPlatform: Array<{ platform: string; count: number; avgEngagement: number }>;
  bySentiment: Array<{ sentiment: string; count: number }>;
}
interface Video { id: number; title: string; author: string; platform: string; playCount: number; likeCount: number; commentCount: number; shareCount: number; sentiment: string; hashtags: string; comments: string; publishedAt: string; }
interface Hashtag { tag: string; count: number }

const users = ref<User[]>([]);
const userId = ref<number | string>('');
const tasks = ref<Task[]>([]);
const taskId = ref<number | undefined>();
const loading = ref(false);
const videos = ref<Video[]>([]);
const stats = ref<VideoStats | null>(null);
const platformFilter = ref('all');
const dateRange = ref<[string, string] | null>(null);
const topLimit = ref(20);
const hashtags = ref<Hashtag[]>([]);
const expandedVideo = ref<Video | null>(null);

const platformChartRef = ref<HTMLElement>();
const sentimentChartRef = ref<HTMLElement>();
let platformChart: echarts.ECharts | null = null;
let sentimentChart: echarts.ECharts | null = null;

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function formatDate(d: string): string { return new Date(d).toLocaleDateString('zh-CN'); }
function platformLabel(p: string): string { return { douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书' }[p] || p; }
function parseComments(c: string): Array<{ user: string; content: string; likes: number }> {
  if (!c) return [];
  try { return JSON.parse(c); } catch { return []; }
}
function calcTagSize(count: number): number {
  const max = Math.max(...hashtags.value.map(h => h.count), 1);
  return 12 + (count / max) * 20;
}
function calcTagOpacity(count: number): number {
  const max = Math.max(...hashtags.value.map(h => h.count), 1);
  return 0.5 + (count / max) * 0.5;
}
function toggleExpand(row: Video): void {
  expandedVideo.value = expandedVideo.value?.id === row.id ? null : row;
}

async function fetchUsers(): Promise<void> {
  try { users.value = await http.get('/admin/users') as User[]; } catch { /* ignore */ }
}
async function fetchTasks(): Promise<void> {
  const params: Record<string, unknown> = {};
  if (userId.value) params.userId = userId.value;
  try {
    const data = await http.get('/admin/monitor-tasks', { params }) as Task[];
    tasks.value = data;
    if (data.length > 0 && !taskId.value) taskId.value = data[0].id;
  } catch { /* ignore */ }
}
async function fetchStats(): Promise<void> {
  if (!taskId.value) return;
  stats.value = await http.get(`/short-videos/${taskId.value}/stats`) as VideoStats;
}
async function fetchVideos(): Promise<void> {
  if (!taskId.value) return;
  const params: Record<string, unknown> = { page: 1, pageSize: topLimit.value };
  if (platformFilter.value !== 'all') params.platform = platformFilter.value;
  if (dateRange.value) { params.dateFrom = dateRange.value[0]; params.dateTo = dateRange.value[1]; }
  const res = await http.get(`/short-videos/${taskId.value}`, { params }) as { items: Video[]; total: number };
  videos.value = res.items;
}
async function fetchHashtags(): Promise<void> {
  if (!taskId.value) return;
  try { hashtags.value = await http.get(`/short-videos/${taskId.value}/hashtags`) as Hashtag[]; } catch { hashtags.value = []; }
}
async function fetchAll(): Promise<void> {
  if (!taskId.value) return;
  loading.value = true;
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
        type: 'pie', radius: ['40%', '70%'],
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
}
function exportData(): void {
  if (!taskId.value) return;
  const params = new URLSearchParams();
  params.set('taskId', String(taskId.value));
  if (platformFilter.value !== 'all') params.set('platform', platformFilter.value);
  const token = localStorage.getItem('admin_token');
  window.open(`/api/short-videos/${taskId.value}?page=1&pageSize=9999&token=${token || ''}`, '_blank');
}

watch(userId, () => { fetchTasks(); });
watch(taskId, () => { fetchAll(); });

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.short-video-page { animation: fade-in 250ms ease-out both; }
.sv-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
.sv-platform-tabs { margin-bottom: 16px; display: flex; align-items: center; }
.sv-table-wrapper { margin-bottom: 24px; }
.sv-table-wrapper :deep(.el-table) { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); }
.sv-table-wrapper :deep(.el-table th) { background: rgba(94, 114, 228, 0.08); color: var(--text-secondary); }
.sv-table-wrapper :deep(.el-table tr) { cursor: pointer; }
.sv-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 20px; }
.sv-chart-item { min-width: 0; }
.sv-hashtag-cloud { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.sv-hashtag-cloud__item { color: var(--color-primary-light); cursor: pointer; transition: all var(--transition-fast); }
.sv-hashtag-cloud__item:hover { color: var(--color-primary); transform: scale(1.1); }
.sv-expanded { margin-top: 20px; }
.sv-comment-row { display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); }
.sv-comment-row:last-child { border: none; }
.sv-comment-row__body { flex: 1; }
.sv-comment-row__user { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.sv-comment-row__text { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.sv-comment-row__likes { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }
</style>
