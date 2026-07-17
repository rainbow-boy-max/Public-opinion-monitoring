<template>
  <div class="comparison-page">
    <GlassCard title="多维对比分析" subtitle="多关键词组、多平台、多时段舆情对比">
      <template #extra>
        <el-button type="primary" :loading="loading" @click="runComparison" icon="DataAnalysis">开始对比</el-button>
        <el-dropdown v-if="hasResult" @command="onExport">
          <el-button>导出</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="md">导出 Markdown</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
              <el-dropdown-item command="docx">导出 Word</el-dropdown-item>
              <el-dropdown-item command="xlsx">导出 Excel</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <div class="query-builder">
        <div v-for="(group, idx) in queryGroups" :key="idx" class="query-group">
          <div class="query-group__header">
            <span class="query-group__label">对比组 {{ idx + 1 }}</span>
            <el-button v-if="queryGroups.length > 2" size="small" type="danger" text @click="removeGroup(idx)">移除</el-button>
          </div>
          <div class="query-group__fields">
            <el-input v-model="group.label" placeholder="组标签" style="width: 140px" size="small" />
            <el-select v-model="group.keywords" multiple filterable allow-create default-first-option placeholder="输入关键词后回车" style="flex:1; min-width:180px" size="small" />
          </div>
        </div>
        <div class="query-actions">
          <el-button v-if="queryGroups.length < 5" size="small" @click="addGroup">+ 添加对比组</el-button>
        </div>
        <div class="query-filters">
          <el-select v-model="selectedPlatforms" multiple placeholder="平台过滤" style="width: 240px" size="small" clearable>
            <el-option v-for="p in platforms" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" size="small" style="width: 240px" :shortcuts="dateShortcuts" />
          <el-radio-group v-model="interval" size="small">
            <el-radio-button value="hour">按小时</el-radio-button>
            <el-radio-button value="day">按天</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </GlassCard>

    <template v-if="hasResult">
      <GlassCard title="对比概览" padded>
        <el-table :data="overviewRows" stripe size="small" border>
          <el-table-column prop="label" label="对比组" width="160" />
          <el-table-column prop="total" label="总量" width="70" align="center" />
          <el-table-column label="正面" width="70" align="center">
            <template #default="{ row }"><span style="color:#34D399">{{ row.positive }}</span></template>
          </el-table-column>
          <el-table-column label="负面" width="70" align="center">
            <template #default="{ row }"><span style="color:#F87171">{{ row.negative }}</span></template>
          </el-table-column>
          <el-table-column label="中性" width="70" align="center">
            <template #default="{ row }"><span style="color:#94A3B8">{{ row.neutral }}</span></template>
          </el-table-column>
          <el-table-column prop="dominantPlatform" label="主要平台" width="110" align="center" />
          <el-table-column prop="avgEngagement" label="平均互动" width="90" align="center" />
        </el-table>
      </GlassCard>

      <div class="charts-grid">
        <GlassCard title="情感分布" subtitle="堆叠柱状图">
          <div ref="stackedEl" style="height: 280px" />
        </GlassCard>
        <GlassCard title="声量趋势" subtitle="折线图">
          <div ref="trendEl" style="height: 280px" />
        </GlassCard>
        <GlassCard title="平台雷达" subtitle="多组对比">
          <div ref="radarEl" style="height: 280px" />
        </GlassCard>
      </div>

      <GlassCard title="热门文章 Top 10" padded>
        <el-table :data="topArticleRows" stripe size="small" style="width:100%">
          <el-table-column prop="group" label="对比组" width="130" />
          <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="90" align="center" />
          <el-table-column prop="engagement" label="互动量" width="90" align="center" sortable />
        </el-table>
      </GlassCard>
    </template>

    <div v-if="!hasResult && !loading" class="empty-hint">
      <el-empty description="配置对比条件后点击「开始对比」">
        <el-button type="primary" @click="loadMock">加载示例数据</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface QueryGroup {
  label: string;
  keywords: string[];
}

interface ComparisonResult {
  groups: Array<{
    label: string;
    keywords: string[];
    stats: {
      total: number;
      bySentiment: { positive: number; negative: number; neutral: number };
      byPlatform: Record<string, number>;
      trend: Array<{ time: string; count: number }>;
      avgEngagement: number;
      topArticles: Array<{ title: string; platform: string; url: string; engagement: number }>;
    };
  }>;
  period: { start: string; end: string };
}

const loading = ref(false);
const result = ref<ComparisonResult | null>(null);

const queryGroups = ref<QueryGroup[]>([
  { label: '品牌A', keywords: ['品牌A'] },
  { label: '品牌B', keywords: ['品牌B'] },
]);

const selectedPlatforms = ref<string[]>([]);
const dateRange = ref<[Date, Date]>([new Date(Date.now() - 6 * 86400000), new Date()]);
const interval = ref<'hour' | 'day'>('day');

const dateShortcuts = [
  { text: '近 7 天', value: () => [new Date(Date.now() - 6 * 86400000), new Date()] as [Date, Date] },
  { text: '近 30 天', value: () => [new Date(Date.now() - 29 * 86400000), new Date()] as [Date, Date] },
  { text: '近 90 天', value: () => [new Date(Date.now() - 89 * 86400000), new Date()] as [Date, Date] },
  { text: '近 12 个月', value: () => [new Date(Date.now() - 364 * 86400000), new Date()] as [Date, Date] },
];

const platforms = [
  { label: '微博', value: 'weibo' },
  { label: '微信', value: 'weixin' },
  { label: '抖音', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: '快手', value: 'kuaishou' },
  { label: '百家号', value: 'baijiahao' },
];

const stackedEl = ref<HTMLElement>();
const trendEl = ref<HTMLElement>();
const radarEl = ref<HTMLElement>();
let stackedChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;
let radarChart: echarts.ECharts | null = null;

const hasResult = computed(() => result.value && result.value.groups.length > 0);

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 50, right: 20, top: 40, bottom: 28 },
};

const overviewRows = computed(() => {
  if (!result.value) return [];
  return result.value.groups.map((g) => {
    const platforms = Object.entries(g.stats.byPlatform);
    const dominant = platforms.sort((a, b) => b[1] - a[1])[0];
    return { label: g.label, total: g.stats.total, positive: g.stats.bySentiment.positive, negative: g.stats.bySentiment.negative, neutral: g.stats.bySentiment.neutral, dominantPlatform: dominant ? dominant[0] : '-', avgEngagement: g.stats.avgEngagement };
  });
});

const topArticleRows = computed(() => {
  if (!result.value) return [];
  const rows: Array<{ group: string; title: string; platform: string; engagement: number }> = [];
  result.value.groups.forEach((g) => {
    g.stats.topArticles.forEach((a) => {
      rows.push({ group: g.label, title: a.title, platform: a.platform, engagement: a.engagement });
    });
  });
  return rows.sort((a, b) => b.engagement - a.engagement).slice(0, 10);
});

function addGroup(): void {
  if (queryGroups.value.length < 5) {
    queryGroups.value.push({ label: '', keywords: [] });
  }
}

function removeGroup(idx: number): void {
  queryGroups.value.splice(idx, 1);
}

function buildPayload(): any {
  return {
    keywords: queryGroups.value.map((g) => g.keywords),
    platforms: selectedPlatforms.value.length > 0 ? selectedPlatforms.value : undefined,
    startDate: dateRange.value[0].toISOString(),
    endDate: dateRange.value[1].toISOString(),
    interval: interval.value,
  };
}

async function runComparison(): Promise<void> {
  loading.value = true;
  try {
    const data = await http.post('/comparison/analyze', buildPayload()) as ComparisonResult;
    result.value = data;
    await nextTick();
    initCharts();
  } catch {
    result.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadMock(): Promise<void> {
  loading.value = true;
  try {
    const data = await http.post('/comparison/analyze?mock=true', buildPayload()) as ComparisonResult;
    result.value = data;
    await nextTick();
    initCharts();
  } catch {
    result.value = getMockResult();
    await nextTick();
    initCharts();
  } finally {
    loading.value = false;
  }
}

function exportJson(): void {
  const data = JSON.stringify(result.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comparison-result.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function onExport(format: string): Promise<void> {
  if (!result.value) return;
  const groups = result.value.groups;
  const sections = [
    { heading: '对比概览', content: groups.map(g =>
      `${g.label}: 总量=${g.stats.total}, 正面=${g.stats.bySentiment.positive}, 负面=${g.stats.bySentiment.negative}, 中性=${g.stats.bySentiment.neutral}`
    ).join('\n'), type: 'text' as const },
    { heading: '平台分布', content: '|对比组|' + Object.keys(groups[0]?.stats.byPlatform || {}).join('|') + '|\n' +
      '|' + groups.map(g => g.label + '|' + Object.values(g.stats.byPlatform).join('|')).join('|\n') + '|', type: 'table' as const },
    { heading: '热门文章 Top 10', content: groups.flatMap(g =>
      g.stats.topArticles.slice(0, 5).map(a => `${g.label}: ${a.title} (${a.platform}, ${a.engagement}互动)`)
    ).join('\n'), type: 'text' as const },
  ];
  try {
    const blob = await http.post('/export/data', { title: '多维对比分析报告', sections, format }, { responseType: 'blob' }) as Blob;
    const extMap: Record<string, string> = { md: 'md', pdf: 'pdf', docx: 'doc', xlsx: 'xlsx' };
    const ext = extMap[format] || format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

const COLORS = ['#5E72E4', '#10B981', '#F59E0B', '#F87171', '#EC4899'];

function initCharts(): void {
  if (!hasResult.value) return;
  drawStacked();
  drawTrend();
  drawRadar();
}

function drawStacked(): void {
  if (!stackedEl.value) return;
  if (!stackedChart) stackedChart = echarts.init(stackedEl.value);
  const names = result.value!.groups.map((g) => g.label);
  stackedChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['正面', '负面', '中性'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5' } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
    series: [
      { name: '正面', type: 'bar', stack: 's', data: result.value!.groups.map((g) => g.stats.bySentiment.positive), itemStyle: { color: '#34D399' } },
      { name: '负面', type: 'bar', stack: 's', data: result.value!.groups.map((g) => g.stats.bySentiment.negative), itemStyle: { color: '#F87171' } },
      { name: '中性', type: 'bar', stack: 's', data: result.value!.groups.map((g) => g.stats.bySentiment.neutral), itemStyle: { color: '#94A3B8' } },
    ],
  });
}

function drawTrend(): void {
  if (!trendEl.value) return;
  if (!trendChart) trendChart = echarts.init(trendEl.value);
  const groups = result.value!.groups;
  const times = groups[0]?.stats.trend.map((t) => t.time) || [];
  trendChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: groups.map((g) => g.label), textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, axisLabel: { color: '#9DA8E5', rotate: 30 } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } }, axisLabel: { color: '#9DA8E5' } },
    series: groups.map((g, i) => ({
      name: g.label, type: 'line', smooth: true,
      data: g.stats.trend.map((t) => t.count),
      symbolSize: 4, itemStyle: { color: COLORS[i % COLORS.length] },
      lineStyle: { width: 2, color: COLORS[i % COLORS.length] },
    })),
  });
}

function drawRadar(): void {
  if (!radarEl.value) return;
  if (!radarChart) radarChart = echarts.init(radarEl.value);
  const groups = result.value!.groups;
  const allPlatforms = [...new Set(groups.flatMap((g) => Object.keys(g.stats.byPlatform)))];
  const maxVal = Math.max(...groups.flatMap((g) => Object.values(g.stats.byPlatform)), 1);
  radarChart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    tooltip: { backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: groups.map((g) => g.label), textStyle: { color: '#9DA8E5' }, bottom: 0 },
    radar: {
      indicator: allPlatforms.map((p) => ({ name: p, max: maxVal })),
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      splitArea: { areaStyle: { color: ['rgba(94,114,228,0.02)', 'rgba(94,114,228,0.05)'] } },
      axisLabel: { color: '#9DA8E5' },
    },
    series: [{
      type: 'radar',
      data: groups.map((g, i) => ({
        value: allPlatforms.map((p) => g.stats.byPlatform[p] || 0),
        name: g.label,
        lineStyle: { color: COLORS[i % COLORS.length] },
        areaStyle: { color: COLORS[i % COLORS.length], opacity: 0.15 },
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    }],
  });
}

function getMockResult(): ComparisonResult {
  const now = Date.now();
  const day = 86400000;
  const trend = (base: number, peak: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      time: new Date(now - (6 - i) * day).toISOString().slice(0, 10),
      count: Math.round(base + Math.random() * peak + i * 15),
    }));
  return {
    groups: [
      {
        label: '品牌A', keywords: ['品牌A'],
        stats: {
          total: 2847, bySentiment: { positive: 1203, negative: 856, neutral: 788 },
          byPlatform: { weibo: 980, weixin: 654, douyin: 523, xiaohongshu: 412, baijiahao: 278 },
          trend: trend(100, 200), avgEngagement: 102,
          topArticles: [
            { title: '品牌A新品发布引发行业热议', platform: 'weibo', url: '#', engagement: 45200 },
            { title: '品牌A用户体验深度评测报告', platform: 'weixin', url: '#', engagement: 32100 },
            { title: '品牌A价格策略调整引争议', platform: 'douyin', url: '#', engagement: 28700 },
          ],
        },
      },
      {
        label: '品牌B', keywords: ['品牌B'],
        stats: {
          total: 2135, bySentiment: { positive: 356, negative: 1120, neutral: 659 },
          byPlatform: { weibo: 756, weixin: 432, douyin: 389, xiaohongshu: 298, baijiahao: 260 },
          trend: trend(50, 150), avgEngagement: 214,
          topArticles: [
            { title: '品牌B产品质量问题引广泛关注', platform: 'weibo', url: '#', engagement: 67800 },
            { title: '品牌B售后体验遭大量投诉', platform: 'xiaohongshu', url: '#', engagement: 42300 },
            { title: '品牌B接受市场监管调查', platform: 'baijiahao', url: '#', engagement: 21500 },
          ],
        },
      },
      {
        label: '品牌C', keywords: ['品牌C'],
        stats: {
          total: 1689, bySentiment: { positive: 987, negative: 234, neutral: 468 },
          byPlatform: { weibo: 456, weixin: 523, douyin: 298, xiaohongshu: 234, baijiahao: 178 },
          trend: trend(80, 180), avgEngagement: 73,
          topArticles: [
            { title: '品牌C创新设计荣获国际大奖', platform: 'weixin', url: '#', engagement: 18900 },
            { title: '品牌C环保理念赢得用户好评', platform: 'weibo', url: '#', engagement: 15600 },
            { title: '品牌C发布全新品牌升级战略', platform: 'baijiahao', url: '#', engagement: 12300 },
          ],
        },
      },
    ],
    period: { start: new Date(now - 6 * day).toISOString().slice(0, 10), end: new Date(now).toISOString().slice(0, 10) },
  };
}

const onResize = () => {
  stackedChart?.resize();
  trendChart?.resize();
  radarChart?.resize();
};

onMounted(() => {
  window.addEventListener('resize', onResize);
});
</script>

<style scoped>
.comparison-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.query-builder {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.query-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: rgba(94, 114, 228, 0.04);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.query-group__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.query-group__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.query-group__fields {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.query-actions {
  display: flex;
  gap: 8px;
}

.query-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.charts-grid > :last-child {
  grid-column: 1 / -1;
}

.empty-hint {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
