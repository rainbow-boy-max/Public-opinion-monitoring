<template>
  <div class="kol-page">
    <GlassCard title="KOL 影响力分析" subtitle="关键意见领袖排名与分析">
      <template #extra>
        <el-select v-model="timeRange" style="width: 140px" size="small" @change="loadData">
          <el-option label="近 7 天" :value="7" />
          <el-option label="近 30 天" :value="30" />
          <el-option label="近 90 天" :value="90" />
        </el-select>
        <el-button size="small" type="primary" :loading="loading" @click="loadData">刷新</el-button>
        <el-button v-if="!hasData && !loading" size="small" @click="loadMock">加载示例</el-button>
      </template>
    </GlassCard>

    <GlassCard v-loading="loading" title="KOL 排名" subtitle="按影响力评分排序" style="margin-top: 20px">
      <template v-if="!hasData && !loading">
        <div class="empty-state">
          <p>暂无 KOL 数据</p>
          <el-button type="primary" @click="loadMock">加载示例数据</el-button>
        </div>
      </template>
      <template v-else>
        <el-table :data="kols" stripe style="width: 100%">
          <el-table-column label="排名" width="70" align="center">
            <template #default="{ $index }">
              <span class="rank-badge" :class="'rank-badge--top' + ($index + 1)">{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="姓名" min-width="160">
            <template #default="{ row }">
              <div class="kol-name" @click="showDetail(row)">{{ row.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="主要平台" width="120">
            <template #default="{ row }">
              <PlatformTag :platform="row.platform" :label="platformLabel(row.platform)" />
            </template>
          </el-table-column>
          <el-table-column prop="totalMentions" label="提及数" width="90" align="center" sortable />
          <el-table-column prop="totalEngagement" label="互动量" width="110" align="center" sortable>
            <template #default="{ row }">
              {{ formatNum(row.totalEngagement) }}
            </template>
          </el-table-column>
          <el-table-column label="情感倾向" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="sentimentTagType(row.avgSentiment)" size="small" effect="dark">
                {{ sentimentLabel(row.avgSentiment) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="influenceScore" label="影响力" width="110" align="center" sortable>
            <template #default="{ row }">
              <div class="score-bar-wrapper">
                <el-progress :percentage="row.influenceScore" :stroke-width="10" :color="scoreColor(row.influenceScore)" />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="趋势" width="80" align="center">
            <template #default="{ row }">
              <span :class="'trend-' + row.trend">
                {{ row.trend === 'rising' ? '上升' : row.trend === 'declining' ? '下降' : '稳定' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="showDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </GlassCard>

    <el-dialog v-model="detailVisible" :title="'KOL 详情 - ' + (detail?.name || '')" width="720">
      <template v-if="detail">
        <div class="detail-section">
          <h4 class="detail-title">基本信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">姓名</span>
              <span class="detail-value">{{ detail.name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">主要平台</span>
              <PlatformTag :platform="detail.platform" :label="platformLabel(detail.platform)" />
            </div>
            <div class="detail-item">
              <span class="detail-label">提及次数</span>
              <span class="detail-value">{{ detail.totalMentions }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总互动量</span>
              <span class="detail-value">{{ formatNum(detail.totalEngagement) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">平均情感</span>
              <el-tag :type="sentimentTagType(detail.avgSentiment)" size="small" effect="dark">
                {{ sentimentLabel(detail.avgSentiment) }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">影响力评分</span>
              <el-progress :percentage="detail.influenceScore" :stroke-width="12" :color="scoreColor(detail.influenceScore)" style="width: 160px" />
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="detail-title">平台分布</h4>
          <div class="platform-chips">
            <span v-for="(count, platform) in detail.platformBreakdown" :key="platform" class="platform-chip">
              <PlatformTag :platform="platform" :label="platformLabel(platform)" />
              <span class="platform-count">{{ count }} 条</span>
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="detail-title">情感趋势</h4>
          <div ref="sentimentChartEl" style="height: 200px" />
        </div>

        <div class="detail-section">
          <h4 class="detail-title">最近文章</h4>
          <div class="article-list">
            <div v-for="art in detail.recentArticles.slice(0, 10)" :key="art.title" class="article-item">
              <a :href="art.url" target="_blank" class="article-title">{{ art.title }}</a>
              <div class="article-meta">
                <span class="article-time">{{ formatDate(art.publishedAt) }}</span>
                <SentimentBadge :type="art.sentiment" />
                <span class="article-engagement">互动 {{ formatNum(art.engagement) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

interface KolProfile {
  id: string;
  name: string;
  avatar?: string;
  platform: string;
  totalMentions: number;
  totalEngagement: number;
  avgSentiment: number;
  influenceScore: number;
  topKeywords: string[];
  trend: 'rising' | 'stable' | 'declining';
}

interface KolDetail extends KolProfile {
  recentArticles: Array<{ title: string; url: string; publishedAt: Date; engagement: number; sentiment: string }>;
  sentimentTrend: Array<{ date: string; score: number }>;
  platformBreakdown: Record<string, number>;
}

const loading = ref(false);
const kols = ref<KolProfile[]>([]);
const detail = ref<KolDetail | null>(null);
const detailVisible = ref(false);
const timeRange = ref(30);
const sentimentChartEl = ref<HTMLElement>();

const hasData = computed(() => kols.value.length > 0);

const PLATFORM_LABELS: Record<string, string> = {
  weixin: '微信', douyin: '抖音', xiaohongshu: '小红书',
  kuaishou: '快手', weibo: '微博', baijiahao: '百家号',
};

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] || p;
}

function sentimentTagType(s: number): string {
  if (s > 0.3) return 'success';
  if (s < -0.3) return 'danger';
  return 'info';
}

function sentimentLabel(s: number): string {
  if (s > 0.3) return '正面';
  if (s < -0.3) return '负面';
  return '中性';
}

function scoreColor(s: number): string {
  if (s >= 80) return '#67C23A';
  if (s >= 50) return '#E6A23C';
  return '#F56C6C';
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString('zh-CN', { hour12: false });
}

async function loadData() {
  loading.value = true;
  try {
    const data = await http.get('/kol/top', {
      params: { days: timeRange.value, limit: 50 },
    }) as KolProfile[];
    kols.value = data || [];
  } catch {
    kols.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMock() {
  loading.value = true;
  try {
    const data = await http.get('/kol/mock') as KolProfile[];
    kols.value = data || [];
  } catch {
    kols.value = [
      { id: '1', name: '热门话题君', platform: 'weibo', totalMentions: 156, totalEngagement: 850000, avgSentiment: -0.6, influenceScore: 92, topKeywords: ['质量', '品牌', '曝光'], trend: 'rising' },
      { id: '2', name: '科技早报', platform: 'weixin', totalMentions: 89, totalEngagement: 320000, avgSentiment: -0.3, influenceScore: 85, topKeywords: ['科技', '产品', '评测'], trend: 'stable' },
      { id: '3', name: '消费预警', platform: 'douyin', totalMentions: 203, totalEngagement: 1200000, avgSentiment: -0.8, influenceScore: 95, topKeywords: ['提醒', '质量问题', '避坑'], trend: 'rising' },
      { id: '4', name: '社会热点', platform: 'kuaishou', totalMentions: 67, totalEngagement: 560000, avgSentiment: -0.5, influenceScore: 78, topKeywords: ['维权', '集体', '扩散'], trend: 'declining' },
      { id: '5', name: '品牌观察', platform: 'xiaohongshu', totalMentions: 112, totalEngagement: 280000, avgSentiment: 0.2, influenceScore: 88, topKeywords: ['品牌', '设计', '体验'], trend: 'rising' },
    ];
  } finally {
    loading.value = false;
  }
}

async function showDetail(row: KolProfile) {
  detailVisible.value = true;
  try {
    const data = await http.get(`/kol/${encodeURIComponent(row.name)}/detail`) as KolDetail;
    detail.value = data;
  } catch {
    detail.value = row as KolDetail;
    detail.value.recentArticles = [];
    detail.value.sentimentTrend = [];
    detail.value.platformBreakdown = {};
  }
  await nextTick();
  drawSentimentChart();
}

function drawSentimentChart() {
  if (!sentimentChartEl.value || !detail.value?.sentimentTrend?.length) return;
  const chart = echarts.init(sentimentChartEl.value);
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    grid: { left: 50, right: 20, top: 24, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    xAxis: { type: 'category', data: detail.value.sentimentTrend.map(t => t.date), axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5' } },
    yAxis: { type: 'value', min: -1, max: 1, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
    series: [{
      type: 'line', smooth: true,
      data: detail.value.sentimentTrend.map(t => t.score),
      itemStyle: { color: '#5E72E4' },
      lineStyle: { width: 2, color: '#5E72E4' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(94,114,228,0.4)' },
        { offset: 1, color: 'rgba(94,114,228,0)' },
      ]) },
      markLine: { data: [{ yAxis: 0 }], lineStyle: { color: 'rgba(140,155,240,0.3)', type: 'dashed' } },
      markArea: {
        data: [
          [{ yAxis: 0, itemStyle: { color: 'rgba(248,113,113,0.06)' } }, { yAxis: -1 }],
          [{ yAxis: 0, itemStyle: { color: 'rgba(52,211,153,0.06)' } }, { yAxis: 1 }],
        ],
      },
    }],
  });
}

onMounted(loadData);
</script>

<style scoped>
.kol-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  gap: 16px;
  color: var(--text-tertiary);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  background: rgba(94, 114, 228, 0.12);
  color: #A5B4FC;
}

.rank-badge--top1 {
  background: linear-gradient(135deg, #F59E0B, #F97316);
  color: #fff;
}

.rank-badge--top2 {
  background: linear-gradient(135deg, #94A3B8, #64748B);
  color: #fff;
}

.rank-badge--top3 {
  background: linear-gradient(135deg, #CD7F32, #A0522D);
  color: #fff;
}

.kol-name {
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
}

.kol-name:hover {
  text-decoration: underline;
}

.score-bar-wrapper {
  width: 100px;
}

.trend-rising { color: #34D399; font-weight: 600; }
.trend-declining { color: #F87171; font-weight: 600; }
.trend-stable { color: #94A3B8; }

.detail-section {
  margin-bottom: 24px;
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.detail-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.platform-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.platform-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.platform-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.article-item {
  padding: 10px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.article-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  text-decoration: none;
  display: block;
  margin-bottom: 4px;
}

.article-title:hover {
  text-decoration: underline;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.article-engagement {
  margin-left: auto;
}
</style>
