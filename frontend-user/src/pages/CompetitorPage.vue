<template>
  <div class="competitor-page">
    <div class="competitor-page__header">
      <PageHeader title="竞品对比" subtitle="实时追踪竞品舆情动态">
        <template #actions>
          <el-select v-model="selectedGroupId" placeholder="选择竞品组" style="width: 200px" @change="loadComparison" :loading="loadingGroups">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
          <el-radio-group v-model="timeRange" size="small" @change="loadComparison">
            <el-radio-button value="24h">24时</el-radio-button>
            <el-radio-button value="7d">7天</el-radio-button>
            <el-radio-button value="30d">30天</el-radio-button>
          </el-radio-group>
        </template>
      </PageHeader>
    </div>

    <div v-if="!hasData" class="competitor-page__empty">
      <GlassCard>
        <el-empty description="暂无竞品数据">
          <el-button v-if="!loadingGroups && groups.length === 0" disabled>暂无可选竞品组</el-button>
          <el-button v-else type="primary" @click="loadDemo">加载示例</el-button>
        </el-empty>
      </GlassCard>
    </div>

    <template v-if="hasData">
      <div class="competitor-insights">
        <GlassCard v-for="c in comparisonData.competitors" :key="c.id" class="insight-card" hoverable>
          <div class="insight-card__head">
            <strong class="insight-card__name">{{ c.name }}</strong>
            <el-tag v-if="c.shareOfVoice > 0.3" type="warning" size="small" effect="dark">高关注</el-tag>
          </div>
          <div class="insight-card__body">
            <div class="insight-card__metric">
              <span class="insight-card__val">{{ c.totalMentions.toLocaleString() }}</span>
              <span class="insight-card__lbl">声量</span>
            </div>
            <div class="insight-card__metric">
              <span class="insight-card__val" :style="{ color: sentimentColor(c.sentimentScore) }">{{ c.sentimentScore.toFixed(1) }}</span>
              <span class="insight-card__lbl">情感分</span>
            </div>
            <div class="insight-card__metric">
              <span class="insight-card__val">{{ (c.shareOfVoice * 100).toFixed(0) }}%</span>
              <span class="insight-card__lbl">占比</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <div class="competitor-charts">
        <GlassCard title="情感对比" subtitle="正面 / 负面 / 中性">
          <div ref="stackedEl" style="height: 260px" />
        </GlassCard>
        <GlassCard title="声量趋势" subtitle="各竞品小时级变化">
          <div ref="trendEl" style="height: 260px" />
        </GlassCard>
      </div>

      <GlassCard title="关键词洞察" subtitle="各竞品热门关键词 Top5">
        <el-table :data="keywordRows" stripe size="small">
          <el-table-column label="竞品" width="120">
            <template #default="{ row }">
              <strong>{{ row.competitor }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="关键词">
            <template #default="{ row }">
              <el-tag v-for="kw in row.keywords" :key="kw.keyword" size="small" style="margin: 2px 4px 2px 0">
                {{ kw.keyword }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </GlassCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';

defineOptions({ name: 'CompetitorPage' });

interface Competitor {
  id: number;
  name: string;
  keywords: string[];
  platforms: string[];
}

interface CompetitorGroup {
  id: number;
  name: string;
  competitors: Competitor[];
  createdAt: string;
}

interface CompetitorCompItem {
  id: number;
  name: string;
  totalMentions: number;
  sentimentScore: number;
  shareOfVoice: number;
  sentiment: { positive: number; negative: number; neutral: number };
  platformDistribution: { platform: string; count: number }[];
}

interface KeywordItem {
  keyword: string;
  count: number;
  sentiment: string;
}

interface ComparisonResponse {
  competitors: CompetitorCompItem[];
  keywords: { competitor: string; keywords: KeywordItem[] }[];
  hourlyTrend: { hour: string; [key: string]: number | string }[];
}

const selectedGroupId = ref<number | null>(null);
const timeRange = ref<'24h' | '7d' | '30d'>('7d');
const loadingGroups = ref(false);
const groups = ref<CompetitorGroup[]>([]);
const comparisonData = ref<ComparisonResponse>({ competitors: [], keywords: [], hourlyTrend: [] });

const stackedEl = ref<HTMLElement>();
const trendEl = ref<HTMLElement>();
let stackedChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;

const hasData = computed(() => comparisonData.value.competitors.length > 0);

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 40, right: 20, top: 32, bottom: 28 },
};

const keywordRows = computed(() => {
  return comparisonData.value.keywords.map(k => ({
    competitor: k.competitor,
    keywords: k.keywords.slice(0, 5),
  }));
});

function sentimentColor(score: number): string {
  if (score >= 7) return '#34D399';
  if (score >= 4) return '#FBBF24';
  return '#F87171';
}

async function loadGroups() {
  loadingGroups.value = true;
  try {
    const data = await http.get('/competitor/groups') as CompetitorGroup[];
    groups.value = data || [];
    if (data.length > 0 && !selectedGroupId.value) {
      selectedGroupId.value = data[0].id;
      await loadComparison();
    }
  } catch {
    groups.value = [];
  } finally {
    loadingGroups.value = false;
  }
}

async function loadComparison() {
  if (!selectedGroupId.value) return;
  try {
    const data = await http.get(`/competitor/groups/${selectedGroupId.value}/comparison`, {
      params: { timeRange: timeRange.value },
    }) as ComparisonResponse;
    comparisonData.value = data;
    await nextTick();
    initCharts();
  } catch {
    comparisonData.value = { competitors: [], keywords: [], hourlyTrend: [] };
  }
}

async function loadDemo() {
  comparisonData.value = getMockData();
  await nextTick();
  initCharts();
}

function initCharts() {
  if (!hasData.value) return;
  drawStacked();
  drawTrend();
}

function drawStacked() {
  if (!stackedEl.value) return;
  if (!stackedChart) stackedChart = echarts.init(stackedEl.value);
  const names = comparisonData.value.competitors.map(c => c.name);
  stackedChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['正面', '负面', '中性'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [
      { name: '正面', type: 'bar', stack: 's', data: comparisonData.value.competitors.map(c => c.sentiment.positive), itemStyle: { color: '#34D399' } },
      { name: '负面', type: 'bar', stack: 's', data: comparisonData.value.competitors.map(c => c.sentiment.negative), itemStyle: { color: '#F87171' } },
      { name: '中性', type: 'bar', stack: 's', data: comparisonData.value.competitors.map(c => c.sentiment.neutral), itemStyle: { color: '#94A3B8' } },
    ],
  });
}

function drawTrend() {
  if (!trendEl.value || !comparisonData.value.hourlyTrend.length) return;
  if (!trendChart) trendChart = echarts.init(trendEl.value);
  const data = comparisonData.value.hourlyTrend;
  const hours = data.map(d => d.hour);
  const names = comparisonData.value.competitors.map(c => c.name);
  const colors = ['#5E72E4', '#10B981', '#F59E0B', '#F87171', '#EC4899', '#8B5CF6'];
  trendChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: names, textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: hours, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: names.map((name, i) => ({
      name,
      type: 'line',
      smooth: true,
      data: data.map(d => d[name] || 0),
      symbolSize: 4,
      itemStyle: { color: colors[i % colors.length] },
      lineStyle: { width: 2, color: colors[i % colors.length] },
    })),
  });
}

function getMockData(): ComparisonResponse {
  return {
    competitors: [
      {
        id: 1, name: '竞品A', totalMentions: 15230, sentimentScore: 6.8, shareOfVoice: 0.35,
        sentiment: { positive: 8230, negative: 2800, neutral: 4200 },
        platformDistribution: [
          { platform: 'weibo', count: 5200 }, { platform: 'weixin', count: 3800 },
          { platform: 'douyin', count: 3100 }, { platform: 'xiaohongshu', count: 1800 },
          { platform: 'kuaishou', count: 830 }, { platform: 'baijiahao', count: 500 },
        ],
      },
      {
        id: 2, name: '竞品B', totalMentions: 9840, sentimentScore: 7.2, shareOfVoice: 0.28,
        sentiment: { positive: 6200, negative: 1240, neutral: 2400 },
        platformDistribution: [
          { platform: 'weibo', count: 3200 }, { platform: 'weixin', count: 2600 },
          { platform: 'douyin', count: 2100 }, { platform: 'xiaohongshu', count: 1200 },
          { platform: 'kuaishou', count: 540 }, { platform: 'baijiahao', count: 200 },
        ],
      },
      {
        id: 3, name: '竞品C', totalMentions: 7210, sentimentScore: 5.4, shareOfVoice: 0.20,
        sentiment: { positive: 3100, negative: 2100, neutral: 2010 },
        platformDistribution: [
          { platform: 'weibo', count: 2400 }, { platform: 'weixin', count: 1800 },
          { platform: 'douyin', count: 1500 }, { platform: 'xiaohongshu', count: 800 },
          { platform: 'kuaishou', count: 410 }, { platform: 'baijiahao', count: 300 },
        ],
      },
      {
        id: 4, name: '竞品D', totalMentions: 4350, sentimentScore: 8.1, shareOfVoice: 0.17,
        sentiment: { positive: 3100, negative: 400, neutral: 850 },
        platformDistribution: [
          { platform: 'weibo', count: 1400 }, { platform: 'weixin', count: 1200 },
          { platform: 'douyin', count: 900 }, { platform: 'xiaohongshu', count: 500 },
          { platform: 'kuaishou', count: 250 }, { platform: 'baijiahao', count: 100 },
        ],
      },
    ],
    keywords: [
      {
        competitor: '竞品A',
        keywords: [
          { keyword: '新品发布', count: 342, sentiment: 'positive' },
          { keyword: '质量问题', count: 215, sentiment: 'negative' },
          { keyword: '用户体验', count: 189, sentiment: 'positive' },
          { keyword: '价格调整', count: 156, sentiment: 'neutral' },
          { keyword: '市场份额', count: 134, sentiment: 'positive' },
        ],
      },
      {
        competitor: '竞品B',
        keywords: [
          { keyword: '融资消息', count: 278, sentiment: 'positive' },
          { keyword: '战略合作', count: 234, sentiment: 'positive' },
          { keyword: '产品迭代', count: 198, sentiment: 'neutral' },
          { keyword: '用户增长', count: 167, sentiment: 'positive' },
          { keyword: '裁员', count: 89, sentiment: 'negative' },
        ],
      },
      {
        competitor: '竞品C',
        keywords: [
          { keyword: '投诉', count: 312, sentiment: 'negative' },
          { keyword: '退款', count: 245, sentiment: 'negative' },
          { keyword: '客服响应', count: 178, sentiment: 'neutral' },
          { keyword: '物流延迟', count: 156, sentiment: 'negative' },
          { keyword: '改进方案', count: 98, sentiment: 'positive' },
        ],
      },
      {
        competitor: '竞品D',
        keywords: [
          { keyword: '创新技术', count: 198, sentiment: 'positive' },
          { keyword: '行业奖项', count: 167, sentiment: 'positive' },
          { keyword: '用户好评', count: 145, sentiment: 'positive' },
          { keyword: '增长策略', count: 112, sentiment: 'neutral' },
          { keyword: '合作伙伴', count: 89, sentiment: 'positive' },
        ],
      },
    ],
    hourlyTrend: Array.from({ length: 24 }, (_, i) => {
      const hour = `${String(i).padStart(2, '0')}:00`;
      const base: any = { hour };
      ['竞品A', '竞品B', '竞品C', '竞品D'].forEach((name, j) => {
        base[name] = Math.round(Math.random() * 150 + (j + 1) * 50 + Math.sin(i / 6 * Math.PI) * 30);
      });
      return base;
    }),
  };
}

const onResize = () => {
  stackedChart?.resize();
  trendChart?.resize();
};

onMounted(async () => {
  await loadGroups();
  if (!hasData.value) loadDemo();
  window.addEventListener('resize', onResize);
});
</script>

<style scoped>
.competitor-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.competitor-page__header {
  margin-bottom: 0;
}

.competitor-page__empty {
  padding: 40px 0;
}

.competitor-insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.insight-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.insight-card__name {
  font-size: 15px;
  color: var(--text-primary);
}

.insight-card__body {
  display: flex;
  gap: 16px;
}

.insight-card__metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 2px;
}

.insight-card__val {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.insight-card__lbl {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.competitor-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .competitor-charts {
    grid-template-columns: 1fr;
  }
}
</style>
