<template>
  <div class="competitor-page">
    <div class="competitor-page__toolbar">
      <div class="competitor-page__group-select">
        <label class="toolbar-label">竞品组：</label>
        <el-select v-model="selectedGroupId" placeholder="选择竞品组" style="width: 260px" @change="loadComparison" :loading="loadingGroups">
          <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openCreateGroup">新建竞品组</el-button>
        <el-button v-if="selectedGroup" :icon="Edit" @click="openEditGroup(selectedGroup)">编辑</el-button>
        <el-button v-if="selectedGroup" type="danger" :icon="Delete" @click="deleteGroup(selectedGroup)">删除</el-button>
      </div>
      <div class="competitor-page__time">
        <el-radio-group v-model="timeRange" size="small" @change="loadComparison">
          <el-radio-button value="24h">24小时</el-radio-button>
          <el-radio-button value="7d">7天</el-radio-button>
          <el-radio-button value="30d">30天</el-radio-button>
        </el-radio-group>
        <el-button size="small" @click="exportJson">导出JSON</el-button>
      </div>
    </div>

    <div v-if="!hasData" class="competitor-page__empty">
      <GlassCard>
        <el-empty description="请选择一个竞品组查看对比数据">
          <el-button v-if="!loadingGroups && groups.length === 0" type="primary" @click="openCreateGroup">创建竞品组</el-button>
          <el-button v-else-if="demoAvailable" type="primary" @click="loadDemo">加载示例数据</el-button>
        </el-empty>
      </GlassCard>
    </div>

    <template v-if="hasData">
      <div class="competitor-cards">
        <GlassCard v-for="c in comparisonData.competitors" :key="c.id" :class="['competitor-card', { 'competitor-card--top': c.shareOfVoice === maxShareOfVoice }]" hoverable>
          <div class="competitor-card__head">
            <div class="competitor-card__name">{{ c.name }}</div>
            <el-tag v-if="c.shareOfVoice === maxShareOfVoice" type="warning" size="small" effect="dark">领先</el-tag>
          </div>
          <div class="competitor-card__stats">
            <div class="competitor-card__stat">
              <span class="competitor-card__stat-value">{{ c.totalMentions.toLocaleString() }}</span>
              <span class="competitor-card__stat-label">声量</span>
            </div>
            <div class="competitor-card__stat">
              <span class="competitor-card__stat-value" :style="{ color: sentimentColor(c.sentimentScore) }">{{ c.sentimentScore.toFixed(1) }}</span>
              <span class="competitor-card__stat-label">情感分</span>
            </div>
            <div class="competitor-card__stat">
              <span class="competitor-card__stat-value">{{ (c.shareOfVoice * 100).toFixed(1) }}%</span>
              <span class="competitor-card__stat-label">声量占比</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <div class="competitor-charts">
        <GlassCard title="指标对比" icon="bars" subtitle="各竞品核心指标对比">
          <div ref="groupedBarEl" style="height: 320px" />
        </GlassCard>
        <GlassCard title="情感分布" icon="pie" subtitle="正/负/中性情感占比">
          <div ref="sentimentStackedEl" style="height: 320px" />
        </GlassCard>
      </div>

      <div class="competitor-charts">
        <GlassCard title="平台分布" icon="globe" subtitle="各竞品平台覆盖雷达图">
          <div ref="radarEl" style="height: 360px" />
        </GlassCard>
        <GlassCard title="小时趋势" icon="trend" subtitle="各竞品声量变化">
          <div ref="hourlyTrendEl" style="height: 320px" />
        </GlassCard>
      </div>

      <GlassCard title="热门关键词" icon="tag" subtitle="各竞品 Top 关键词">
        <el-table :data="keywordRows" stripe style="width: 100%">
          <el-table-column label="竞品" width="140">
            <template #default="{ row }">
              <strong>{{ row.competitor }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="关键词" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="kw in row.keywords" :key="kw.keyword" size="small" style="margin: 2px 4px 2px 0">
                {{ kw.keyword }} <span style="opacity:0.6">({{ kw.count }})</span>
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </GlassCard>
    </template>

    <el-dialog v-model="groupDialogVisible" :title="editingGroup ? '编辑竞品组' : '新建竞品组'" width="640">
      <el-form :model="groupForm" label-width="100px">
        <el-form-item label="组名称" required>
          <el-input v-model="groupForm.name" placeholder="例如：社交平台竞品" />
        </el-form-item>
        <el-form-item label="竞品列表">
          <div v-for="(c, idx) in groupForm.competitors" :key="idx" class="competitor-form-row">
            <el-input v-model="c.name" placeholder="竞品名称" style="width:140px" />
            <el-select v-model="c.keywords" multiple filterable allow-create default-first-option placeholder="关键词（回车添加）" style="width:240px" collapse-tags>
              <el-option v-for="(kw, ki) in c.keywords" :key="ki" :label="kw" :value="kw" />
            </el-select>
            <el-select v-model="c.platforms" multiple placeholder="平台" style="width:160px" collapse-tags>
              <el-option label="微博" value="weibo" />
              <el-option label="微信" value="weixin" />
              <el-option label="抖音" value="douyin" />
              <el-option label="小红书" value="xiaohongshu" />
              <el-option label="快手" value="kuaishou" />
              <el-option label="百家号" value="baijiahao" />
            </el-select>
            <el-button :icon="Delete" circle size="small" @click="removeCompetitor(idx)" />
          </div>
          <el-button size="small" @click="addCompetitor">
            <el-icon><Plus /></el-icon> 添加竞品
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingGroup" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import { Plus, Delete, Edit } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import GlassCard from '@shared/components/GlassCard.vue';

defineOptions({ name: 'CompetitorTrackingPage' });

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
const groupDialogVisible = ref(false);
const editingGroup = ref(false);
const editingGroupId = ref<number | null>(null);
const savingGroup = ref(false);
const groupForm = ref<{ name: string; competitors: { name: string; keywords: string[]; platforms: string[] }[] }>({
  name: '',
  competitors: [],
});

const groupedBarEl = ref<HTMLElement>();
const sentimentStackedEl = ref<HTMLElement>();
const radarEl = ref<HTMLElement>();
const hourlyTrendEl = ref<HTMLElement>();
let groupedBarChart: echarts.ECharts | null = null;
let sentimentStackedChart: echarts.ECharts | null = null;
let radarChart: echarts.ECharts | null = null;
let hourlyTrendChart: echarts.ECharts | null = null;

const hasData = computed(() => comparisonData.value.competitors.length > 0);
const demoAvailable = ref(true);

const selectedGroup = computed(() => groups.value.find(g => g.id === selectedGroupId.value) || null);

const maxShareOfVoice = computed(() => {
  if (!comparisonData.value.competitors.length) return 0;
  return Math.max(...comparisonData.value.competitors.map(c => c.shareOfVoice));
});

const ECHART_BASE = {
  backgroundColor: 'transparent',
  textStyle: { color: '#9DA8E5' },
  grid: { left: 50, right: 24, top: 40, bottom: 32 },
};

const keywordRows = computed(() => {
  return comparisonData.value.keywords.map(k => ({
    competitor: k.competitor,
    keywords: k.keywords.slice(0, 5),
  }));
});

function addCompetitor() {
  groupForm.value.competitors.push({ name: '', keywords: [], platforms: [] });
}

function removeCompetitor(idx: number) {
  groupForm.value.competitors.splice(idx, 1);
}

function openCreateGroup() {
  editingGroup.value = false;
  editingGroupId.value = null;
  groupForm.value = { name: '', competitors: [{ name: '', keywords: [], platforms: [] }] };
  groupDialogVisible.value = true;
}

function openEditGroup(group: CompetitorGroup) {
  editingGroup.value = true;
  editingGroupId.value = group.id;
  let competitors: { name: string; keywords: string[]; platforms: string[] }[] = [];
  try {
    const parsed = typeof group.competitors === 'string' ? JSON.parse(group.competitors) : group.competitors;
    competitors = (parsed || []).map((c: any) => ({
      name: c.name || '',
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
      platforms: Array.isArray(c.platforms) ? c.platforms : [],
    }));
  } catch {
    competitors = [];
  }
  if (competitors.length === 0) competitors = [{ name: '', keywords: [], platforms: [] }];
  groupForm.value = { name: group.name, competitors };
  groupDialogVisible.value = true;
}

async function deleteGroup(group: CompetitorGroup) {
  try {
    await ElMessageBox.confirm(`确定删除竞品组 "${group.name}"？此操作不可撤销`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await http.delete(`/competitor/groups/${group.id}`);
    ElMessage.success('删除成功');
    if (selectedGroupId.value === group.id) {
      selectedGroupId.value = null;
      comparisonData.value = { competitors: [], keywords: [], hourlyTrend: [] };
    }
    await loadGroups();
  } catch {
    ElMessage.error('删除失败');
  }
}

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
  demoAvailable.value = true;
  await nextTick();
  initCharts();
}

async function saveGroup() {
  if (!groupForm.value.name.trim()) {
    ElMessage.warning('请输入组名称');
    return;
  }
  savingGroup.value = true;
  try {
    if (editingGroup.value && editingGroupId.value) {
      await http.put(`/competitor/groups/${editingGroupId.value}`, groupForm.value);
      ElMessage.success('竞品组更新成功');
    } else {
      await http.post('/competitor/groups', groupForm.value);
      ElMessage.success('竞品组创建成功');
    }
    groupDialogVisible.value = false;
    await loadGroups();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    savingGroup.value = false;
  }
}

function exportJson() {
  const data = JSON.stringify(comparisonData.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `competitor-comparison-${selectedGroupId.value || 'demo'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function initCharts() {
  if (!hasData.value) return;
  const competitors = comparisonData.value.competitors;
  drawGroupedBar(competitors);
  drawSentimentStacked(competitors);
  drawRadar(competitors);
  drawHourlyTrend();
}

function drawGroupedBar(competitors: CompetitorCompItem[]) {
  if (!groupedBarEl.value) return;
  if (!groupedBarChart) groupedBarChart = echarts.init(groupedBarEl.value);
  const names = competitors.map(c => c.name);
  groupedBarChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['声量', '情感分(×100)', '声量占比(×100)'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [
      { name: '声量', type: 'bar', data: competitors.map(c => c.totalMentions), itemStyle: { color: '#5E72E4', borderRadius: [4, 4, 0, 0] } },
      { name: '情感分(×100)', type: 'bar', data: competitors.map(c => +(c.sentimentScore * 100).toFixed(0)), itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] } },
      { name: '声量占比(×100)', type: 'bar', data: competitors.map(c => +(c.shareOfVoice * 100).toFixed(0)), itemStyle: { color: '#F59E0B', borderRadius: [4, 4, 0, 0] } },
    ],
  });
}

function drawSentimentStacked(competitors: CompetitorCompItem[]) {
  if (!sentimentStackedEl.value) return;
  if (!sentimentStackedChart) sentimentStackedChart = echarts.init(sentimentStackedEl.value);
  const names = competitors.map(c => c.name);
  sentimentStackedChart.setOption({
    ...ECHART_BASE,
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: ['正面', '负面', '中性'], textStyle: { color: '#9DA8E5' } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [
      { name: '正面', type: 'bar', stack: 'sentiment', data: competitors.map(c => c.sentiment.positive), itemStyle: { color: '#34D399' } },
      { name: '负面', type: 'bar', stack: 'sentiment', data: competitors.map(c => c.sentiment.negative), itemStyle: { color: '#F87171' } },
      { name: '中性', type: 'bar', stack: 'sentiment', data: competitors.map(c => c.sentiment.neutral), itemStyle: { color: '#94A3B8' } },
    ],
  });
}

function drawRadar(competitors: CompetitorCompItem[]) {
  if (!radarEl.value) return;
  if (!radarChart) radarChart = echarts.init(radarEl.value);
  const platforms = ['weibo', 'weixin', 'douyin', 'xiaohongshu', 'kuaishou', 'baijiahao'];
  const platformLabels: Record<string, string> = {
    weibo: '微博', weixin: '微信', douyin: '抖音', xiaohongshu: '小红书', kuaishou: '快手', baijiahao: '百家号',
  };
  const colors = ['#5E72E4', '#10B981', '#F59E0B', '#F87171', '#EC4899', '#8B5CF6'];
  radarChart.setOption({
    ...ECHART_BASE,
    tooltip: { backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { data: competitors.map(c => c.name), textStyle: { color: '#9DA8E5' } },
    radar: {
      indicator: platforms.map(p => ({ name: platformLabels[p] || p, max: 100 })),
      axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } },
      splitArea: { areaStyle: { color: ['rgba(94,114,228,0.02)', 'rgba(94,114,228,0.05)'] } },
    },
    series: [{
      type: 'radar',
      data: competitors.map((c, i) => ({
        value: platforms.map(p => {
          const dist = c.platformDistribution.find(d => d.platform === p);
          return dist ? Math.min(100, +(dist.count / Math.max(...c.platformDistribution.map(d => d.count), 1) * 100).toFixed(0)) : 0;
        }),
        name: c.name,
        itemStyle: { color: colors[i % colors.length] },
        lineStyle: { color: colors[i % colors.length] },
        areaStyle: { color: colors[i % colors.length] + '33' },
      })),
    }],
  });
}

function drawHourlyTrend() {
  if (!hourlyTrendEl.value || !comparisonData.value.hourlyTrend.length) return;
  if (!hourlyTrendChart) hourlyTrendChart = echarts.init(hourlyTrendEl.value);
  const data = comparisonData.value.hourlyTrend;
  const hours = data.map(d => d.hour);
  const names = comparisonData.value.competitors.map(c => c.name);
  const colors = ['#5E72E4', '#10B981', '#F59E0B', '#F87171', '#EC4899', '#8B5CF6'];
  hourlyTrendChart.setOption({
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
      symbolSize: 6,
      itemStyle: { color: colors[i % colors.length] },
      lineStyle: { width: 2, color: colors[i % colors.length] },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: colors[i % colors.length] + '44' },
        { offset: 1, color: colors[i % colors.length] + '00' },
      ]) },
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
      const base = { hour };
      ['竞品A', '竞品B', '竞品C', '竞品D'].forEach((name, j) => {
        (base as any)[name] = Math.round(Math.random() * 150 + (j + 1) * 50 + Math.sin(i / 6 * Math.PI) * 30);
      });
      return base;
    }) as any,
  };
}

const onResize = () => {
  groupedBarChart?.resize();
  sentimentStackedChart?.resize();
  radarChart?.resize();
  hourlyTrendChart?.resize();
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

.competitor-page__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.competitor-page__group-select {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.competitor-page__time {
  display: flex;
  align-items: center;
  gap: 12px;
}

.competitor-page__empty {
  padding: 40px 0;
}

.competitor-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.competitor-card--top {
  border-color: rgba(245, 158, 11, 0.4);
}

.competitor-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.competitor-card__name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.competitor-card__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.competitor-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.competitor-card__stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.competitor-card__stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.competitor-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 1024px) {
  .competitor-charts {
    grid-template-columns: 1fr;
  }
}

.competitor-form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
