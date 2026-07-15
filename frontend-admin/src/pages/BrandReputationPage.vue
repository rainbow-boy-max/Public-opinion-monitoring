<template>
  <div class="brand-reputation-page">
    <GlassCard title="品牌声誉管理" subtitle="品牌声量 / NPS 趋势 / 竞品排名">
      <template #extra>
        <el-button :loading="loading" type="primary" icon="TrendCharts" @click="analyze">分析</el-button>
        <el-button v-if="hasData" icon="Download" @click="exportJson">导出 JSON</el-button>
      </template>
      <div class="config-bar">
        <div class="config-bar__item">
          <label class="config-bar__label">品牌关键词</label>
          <el-select
            v-model="brandKeywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后回车"
            style="width: 400px"
            size="default"
          />
        </div>
        <div class="config-bar__item">
          <label class="config-bar__label">时间范围</label>
          <el-radio-group v-model="timeRange" size="default">
            <el-radio-button value="7">7天</el-radio-button>
            <el-radio-button value="30">30天</el-radio-button>
            <el-radio-button value="90">90天</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </GlassCard>

    <template v-if="hasData">
      <div class="overview-cards">
        <GlassCard class="overview-card">
          <div class="overview-card__inner">
            <div class="overview-card__label">品牌声量</div>
            <div class="overview-card__value">{{ data.overview.brandVoice.toLocaleString() }}</div>
            <div class="overview-card__trend" :class="trendClass(data.overview.trend)">
              <span v-if="data.overview.trend === 'rising'">&#8593;</span>
              <span v-else-if="data.overview.trend === 'declining'">&#8595;</span>
              <span v-else>&#8594;</span>
              {{ trendLabel(data.overview.trend) }}
            </div>
          </div>
        </GlassCard>
        <GlassCard class="overview-card">
          <div class="overview-card__inner">
            <div class="overview-card__label">声量占比</div>
            <div class="overview-card__value">{{ data.overview.shareOfVoice }}<span class="overview-card__unit">%</span></div>
            <div class="overview-card__gauge">
              <el-progress :percentage="data.overview.shareOfVoice" :stroke-width="8" color="var(--color-primary)" />
            </div>
          </div>
        </GlassCard>
        <GlassCard class="overview-card">
          <div class="overview-card__inner">
            <div class="overview-card__label">NPS 得分</div>
            <div class="overview-card__value" :style="{ color: npsColor(data.overview.npsScore) }">{{ data.overview.npsScore }}</div>
            <div class="overview-card__sub">-100 ~ 100</div>
          </div>
        </GlassCard>
        <GlassCard class="overview-card">
          <div class="overview-card__inner">
            <div class="overview-card__label">情感得分</div>
            <div class="overview-card__value" :style="{ color: sentimentColor(data.overview.sentimentScore) }">{{ data.overview.sentimentScore.toFixed(2) }}</div>
            <div class="overview-card__bar">
              <el-progress
                :percentage="((data.overview.sentimentScore + 1) / 2) * 100"
                :stroke-width="8"
                :color="sentimentBarColor(data.overview.sentimentScore)"
              />
            </div>
          </div>
        </GlassCard>
      </div>

      <div class="charts-section">
        <GlassCard title="情感 / NPS 趋势" subtitle="每日情感分布与 NPS 变化">
          <div ref="trendChartEl" style="height: 300px" />
        </GlassCard>
        <GlassCard title="平台分布" subtitle="各平台声量占比">
          <div ref="pieChartEl" style="height: 300px" />
        </GlassCard>
        <GlassCard title="竞品对比" subtitle="声量 / 情感 / 占比">
          <div ref="competitorChartEl" style="height: 300px" />
        </GlassCard>
        <GlassCard title="热门关键词" subtitle="关键词声量与情感">
          <div ref="keywordChartEl" style="height: 300px" />
        </GlassCard>
      </div>

      <GlassCard title="最新提及" subtitle="最近 20 条品牌相关提及">
        <el-table :data="data.recentMentions" stripe size="small" style="width: 100%" max-height="400">
          <el-table-column label="标题" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <a v-if="row.url && row.url !== '#'" :href="row.url" target="_blank" class="mention-link">{{ row.title }}</a>
              <span v-else>{{ row.title }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平台" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="platformTagType(row.platform)" size="small">{{ platformLabel(row.platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="情感" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="sentimentTagType(row.sentiment)" size="small" effect="dark">{{ row.sentiment === 'positive' ? '正面' : row.sentiment === 'negative' ? '负面' : '中性' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="互动量" width="90" align="center" sortable prop="engagement">
            <template #default="{ row }">
              {{ row.engagement.toLocaleString() }}
            </template>
          </el-table-column>
          <el-table-column label="发布时间" width="170" align="center">
            <template #default="{ row }">
              {{ formatDate(row.publishedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button v-if="row.url && row.url !== '#'" link type="primary" size="small" @click="openUrl(row.url)">查看</el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </GlassCard>
    </template>

    <div v-if="!hasData && !loading" class="empty-hint">
      <el-empty description="输入品牌关键词后点击「分析」">
        <el-button type="primary" @click="loadDemo">加载示例数据</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface ReputationData {
  overview: {
    brandVoice: number;
    shareOfVoice: number;
    npsScore: number;
    sentimentScore: number;
    trend: 'rising' | 'stable' | 'declining';
  };
  sentimentTrend: Array<{ date: string; positive: number; negative: number; neutral: number; nps: number }>;
  platformBreakdown: Array<{ platform: string; mentions: number; sentiment: number }>;
  topKeywords: Array<{ keyword: string; count: number; sentiment: number }>;
  competitorComparison: Array<{
    name: string;
    mentions: number;
    sentimentScore: number;
    shareOfVoice: number;
    trend: string;
  }>;
  recentMentions: Array<{
    id: number; title: string; platform: string; sentiment: string;
    engagement: number; publishedAt: Date; url: string;
  }>;
}

const loading = ref(false);
const data = ref<ReputationData | null>(null);
const brandKeywords = ref<string[]>(['品牌A']);
const timeRange = ref<string>('30');

const hasData = computed(() => data.value !== null);

const trendChartEl = ref<HTMLElement>();
const pieChartEl = ref<HTMLElement>();
const competitorChartEl = ref<HTMLElement>();
const keywordChartEl = ref<HTMLElement>();

let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;
let competitorChart: echarts.ECharts | null = null;
let keywordChart: echarts.ECharts | null = null;

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 50, right: 20, top: 40, bottom: 28 },
};

const PLATFORM_MAP: Record<string, string> = {
  weibo: '微博',
  weixin: '微信',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  baijiahao: '百家号',
};

function platformLabel(p: string): string {
  return PLATFORM_MAP[p] || p;
}

function platformTagType(p: string): string {
  const map: Record<string, string> = { weibo: 'danger', weixin: 'success', douyin: '', xiaohongshu: 'warning', kuaishou: '', baijiahao: 'info' };
  return map[p] || '';
}

function sentimentTagType(s: string): string {
  return s === 'positive' ? 'success' : s === 'negative' ? 'danger' : 'info';
}

function trendClass(t: string): string {
  return t === 'rising' ? 'trend-up' : t === 'declining' ? 'trend-down' : 'trend-flat';
}

function trendLabel(t: string): string {
  return t === 'rising' ? '上升' : t === 'declining' ? '下降' : '稳定';
}

function npsColor(score: number): string {
  if (score >= 50) return '#34D399';
  if (score >= 0) return '#FBBF24';
  return '#F87171';
}

function sentimentColor(score: number): string {
  if (score > 0.3) return '#34D399';
  if (score > -0.3) return '#FBBF24';
  return '#F87171';
}

function sentimentBarColor(score: number): string {
  if (score > 0.3) return '#34D399';
  if (score > -0.3) return '#FBBF24';
  return '#F87171';
}

function formatDate(d: Date | string): string {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10) + ' ' + dt.toISOString().slice(11, 16);
}

function openUrl(url: string): void {
  window.open(url, '_blank');
}

async function analyze(): Promise<void> {
  if (brandKeywords.value.length === 0) return;
  loading.value = true;
  try {
    const res = await http.post('/brand-reputation', {
      brandKeywords: brandKeywords.value,
      days: Number(timeRange.value),
    }) as ReputationData;
    data.value = res;
    await nextTick();
    initCharts();
  } catch {
    data.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadDemo(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.post('/brand-reputation?mock=true', {
      brandKeywords: brandKeywords.value,
      days: Number(timeRange.value),
    }) as ReputationData;
    data.value = res;
    await nextTick();
    initCharts();
  } catch {
    const mock = getMockData();
    data.value = mock;
    await nextTick();
    initCharts();
  } finally {
    loading.value = false;
  }
}

function exportJson(): void {
  if (!data.value) return;
  const blob = new Blob([JSON.stringify(data.value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'brand-reputation.json';
  a.click();
  URL.revokeObjectURL(url);
}

function initCharts(): void {
  if (!data.value) return;
  drawTrendChart();
  drawPieChart();
  drawCompetitorChart();
  drawKeywordChart();
}

function drawTrendChart(): void {
  if (!trendChartEl.value || !data.value) return;
  if (!trendChart) trendChart = echarts.init(trendChartEl.value);
  const trend = data.value.sentimentTrend;
  const dates = trend.map((t) => t.date.slice(5));
  const positive = trend.map((t) => t.positive);
  const negative = trend.map((t) => t.negative);
  const neutral = trend.map((t) => t.neutral);
  const nps = trend.map((t) => t.nps);
  trendChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['正面', '负面', '中性', 'NPS'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5', rotate: 45 } },
    yAxis: [
      { type: 'value', name: '数量', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
      { type: 'value', name: 'NPS', min: -100, max: 100, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { show: false }, axisLabel: { color: '#9DA8E5' } },
    ],
    series: [
      { name: '正面', type: 'line', stack: 'sentiment', areaStyle: { opacity: 0.4, color: '#34D399' }, data: positive, itemStyle: { color: '#34D399' }, smooth: true, symbol: 'none' },
      { name: '负面', type: 'line', stack: 'sentiment', areaStyle: { opacity: 0.4, color: '#F87171' }, data: negative, itemStyle: { color: '#F87171' }, smooth: true, symbol: 'none' },
      { name: '中性', type: 'line', stack: 'sentiment', areaStyle: { opacity: 0.4, color: '#94A3B8' }, data: neutral, itemStyle: { color: '#94A3B8' }, smooth: true, symbol: 'none' },
      { name: 'NPS', type: 'line', yAxisIndex: 1, data: nps, itemStyle: { color: '#FBBF24' }, lineStyle: { type: 'dashed', width: 2, color: '#FBBF24' }, smooth: true, symbol: 'none' },
    ],
  });
}

function drawPieChart(): void {
  if (!pieChartEl.value || !data.value) return;
  if (!pieChart) pieChart = echarts.init(pieChartEl.value);
  const pieData = data.value.platformBreakdown.map((p) => ({
    name: platformLabel(p.platform),
    value: p.mentions,
  }));
  pieChart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    tooltip: { backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' }, formatter: '{b}: {c} ({d}%)' },
    legend: { textStyle: { color: '#9DA8E5' }, bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['35%', '60%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: 'rgba(20,25,56,0.8)', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: pieData,
      color: ['#5E72E4', '#10B981', '#F59E0B', '#F87171', '#EC4899', '#8B5CF6'],
    }],
  });
}

function drawCompetitorChart(): void {
  if (!competitorChartEl.value || !data.value) return;
  if (!competitorChart) competitorChart = echarts.init(competitorChartEl.value);
  const comp = data.value.competitorComparison;
  const names = comp.map((c) => c.name);
  competitorChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['声量', '情感得分', '声量占比(%)'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5' } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
    series: [
      { name: '声量', type: 'bar', data: comp.map((c) => c.mentions), itemStyle: { color: '#5E72E4' } },
      { name: '情感得分', type: 'bar', data: comp.map((c) => c.sentimentScore), itemStyle: { color: '#10B981' } },
      { name: '声量占比(%)', type: 'line', smooth: true, data: comp.map((c) => c.shareOfVoice), itemStyle: { color: '#F59E0B' }, lineStyle: { width: 2, color: '#F59E0B' }, symbol: 'circle', symbolSize: 6 },
    ],
  });
}

function drawKeywordChart(): void {
  if (!keywordChartEl.value || !data.value) return;
  if (!keywordChart) keywordChart = echarts.init(keywordChartEl.value);
  const kws = data.value.topKeywords.slice(0, 10);
  const labels = kws.map((k) => k.keyword).reverse();
  const counts = kws.map((k) => k.count).reverse();
  const colors = kws.map((k) => {
    if (k.sentiment > 0.3) return '#34D399';
    if (k.sentiment > -0.3) return '#FBBF24';
    return '#F87171';
  }).reverse();
  keywordChart.setOption({
    ...ECHART_BASE,
    grid: { left: 100, right: 30, top: 20, bottom: 28 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' }, axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
    yAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5' } },
    series: [{
      type: 'bar', data: counts.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
      barWidth: 14,
    }],
  });
}

const onResize = () => {
  trendChart?.resize();
  pieChart?.resize();
  competitorChart?.resize();
  keywordChart?.resize();
};

onMounted(() => {
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

function getMockData(): ReputationData {
  const now = Date.now();
  const day = 86400000;
  const days = Number(timeRange.value) || 30;
  const sentimentTrend: ReputationData['sentimentTrend'] = [];
  let cumPos = 0, cumNeg = 0, cumNeu = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - 1 - i) * day);
    const date = d.toISOString().slice(0, 10);
    const pos = Math.round(80 + Math.random() * 120 + i * 2);
    const neg = Math.round(30 + Math.random() * 60 - i * 0.5);
    const neu = Math.round(40 + Math.random() * 80);
    cumPos += pos; cumNeg += neg; cumNeu += neu;
    const nps = Math.round(((pos - neg) / (pos + neg + neu)) * 100);
    sentimentTrend.push({ date, positive: pos, negative: neg, neutral: neu, nps });
  }
  const totalBrand = cumPos + cumNeg + cumNeu;
  return {
    overview: {
      brandVoice: totalBrand,
      shareOfVoice: 42,
      npsScore: Math.round(((cumPos - cumNeg) / totalBrand) * 100),
      sentimentScore: Math.round(((cumPos * 0.6 + cumNeg * (-0.4)) / totalBrand) * 100) / 100,
      trend: 'rising',
    },
    sentimentTrend,
    platformBreakdown: [
      { platform: 'weibo', mentions: 980, sentiment: 0.32 },
      { platform: 'weixin', mentions: 654, sentiment: 0.45 },
      { platform: 'douyin', mentions: 523, sentiment: -0.12 },
      { platform: 'xiaohongshu', mentions: 412, sentiment: 0.28 },
      { platform: 'kuaishou', mentions: 298, sentiment: 0.15 },
      { platform: 'baijiahao', mentions: 278, sentiment: 0.52 },
    ],
    topKeywords: [
      { keyword: '新品发布', count: 423, sentiment: 0.65 },
      { keyword: '用户体验', count: 312, sentiment: 0.42 },
      { keyword: '价格争议', count: 267, sentiment: -0.38 },
      { keyword: '技术突破', count: 198, sentiment: 0.72 },
      { keyword: '市场份额', count: 156, sentiment: 0.18 },
      { keyword: '售后服务', count: 134, sentiment: -0.22 },
      { keyword: '品牌升级', count: 112, sentiment: 0.55 },
      { keyword: '用户好评', count: 98, sentiment: 0.81 },
    ],
    competitorComparison: [
      { name: '竞品A', mentions: 2847, sentimentScore: 12, shareOfVoice: 35, trend: 'stable' },
      { name: '竞品B', mentions: 2135, sentimentScore: -36, shareOfVoice: 26, trend: 'declining' },
      { name: '竞品C', mentions: 1689, sentimentScore: 45, shareOfVoice: 21, trend: 'rising' },
      { name: '竞品D', mentions: 1456, sentimentScore: 13, shareOfVoice: 18, trend: 'stable' },
    ],
    recentMentions: Array.from({ length: 10 }, (_, i) => ({
      id: 10000 + i,
      title: ['品牌A新品发布会引发行业热议', '品牌A用户体验深度评测报告', '品牌A价格策略调整引争议',
        '品牌A荣获年度创新大奖', '品牌A公益项目获社会各界好评', '品牌A技术突破引领行业发展',
        '品牌A用户满意度调查结果出炉', '品牌A与知名IP联名合作官宣', '品牌A海外市场拓展新进展',
        '品牌A回应产品质量质疑'][i],
      platform: ['weibo', 'weixin', 'douyin', 'xiaohongshu', 'baijiahao', 'weibo', 'kuaishou', 'weixin', 'douyin', 'xiaohongshu'][i],
      sentiment: ['positive', 'neutral', 'negative', 'positive', 'positive', 'positive', 'neutral', 'positive', 'neutral', 'negative'][i],
      engagement: [45200, 32100, 28700, 18900, 15600, 14200, 12800, 11500, 9800, 8700][i],
      publishedAt: new Date(now - i * day * 0.5),
      url: '#',
    })),
  };
}
</script>

<style scoped>
.brand-reputation-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-bar {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 16px;
}

.config-bar__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-bar__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.overview-card__inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overview-card__label {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.overview-card__value {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.overview-card__unit {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 2px;
}

.overview-card__trend {
  font-size: 13px;
  font-weight: 500;
}

.overview-card__trend.trend-up { color: #34D399; }
.overview-card__trend.trend-down { color: #F87171; }
.overview-card__trend.trend-flat { color: #94A3B8; }

.overview-card__sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.overview-card__gauge,
.overview-card__bar {
  margin-top: 4px;
}

.charts-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.mention-link {
  color: var(--color-primary);
  text-decoration: none;
}

.mention-link:hover {
  text-decoration: underline;
}

.empty-hint {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

@media (max-width: 1024px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
}
</style>
