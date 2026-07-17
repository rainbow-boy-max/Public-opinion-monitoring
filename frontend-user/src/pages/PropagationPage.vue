<template>
  <div class="propagation-page">
    <PageHeader title="传播路径追踪" subtitle="可视化舆情传播图谱">
      <template #actions>
        <el-select v-model="selectedTaskId" placeholder="选择监控任务" style="width: 240px" @change="loadGraph">
          <el-option v-for="t in tasks" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-select v-model="timeWindow" style="width: 120px" @change="loadGraph">
          <el-option label="6 小时" :value="6" />
          <el-option label="12 小时" :value="12" />
          <el-option label="24 小时" :value="24" />
          <el-option label="48 小时" :value="48" />
          <el-option label="7 天" :value="168" />
        </el-select>
        <el-button type="primary" @click="loadGraph" :loading="loading">刷新</el-button>
        <el-button v-if="hasData" @click="exportGraph">导出 JSON</el-button>
        <el-button v-if="!hasData && !loading" @click="showDemo">查看示例</el-button>
      </template>
    </PageHeader>

    <p class="page-guide">查看舆情事件在不同平台间的传播扩散路径和关键节点</p>

    <GlassCard title="传播图谱" bare>
      <div v-loading="loading" class="graph-container">
        <div v-if="!hasData && !loading" class="empty-state">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
            </svg>
          </div>
          <div class="empty-state__text">暂无传播数据</div>
          <el-button type="primary" @click="showDemo">加载示例数据</el-button>
        </div>
        <div ref="chartEl" v-show="hasData" class="chart" />
      </div>
    </GlassCard>

    <GlassCard v-if="hasData" title="传播链路详情" subtitle="按传播路径排序" style="margin-top: 24px">
      <el-table :data="linkDetails" stripe style="width: 100%">
        <el-table-column label="来源平台" width="120">
          <template #default="{ row }">
            <PlatformTag :platform="row.sourcePlatform" :label="row.sourcePlatform" />
          </template>
        </el-table-column>
        <el-table-column prop="sourceTitle" label="来源标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="目标平台" width="120">
          <template #default="{ row }">
            <PlatformTag :platform="row.targetPlatform" :label="row.targetPlatform" />
          </template>
        </el-table-column>
        <el-table-column prop="targetTitle" label="目标标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="关系" width="100">
          <template #default="{ row }">
            <el-tag :type="row.relationType === 'repost' ? 'warning' : row.relationType === 'quote' ? 'info' : 'default'" size="small">
              {{ row.relationType === 'repost' ? '转发' : row.relationType === 'quote' ? '引用' : '相似' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="similarity" label="相似度" width="100">
          <template #default="{ row }">
            {{ (row.similarity * 100).toFixed(0) }}%
          </template>
        </el-table-column>
      </el-table>
    </GlassCard>

    <GlassCard v-if="hasData" title="关键意见领袖 (KOL)" subtitle="参与该传播话题的核心影响力作者" style="margin-top: 24px">
      <div v-if="kols.length === 0" class="empty-state">
        <div class="empty-state__text">暂无 KOL 数据</div>
        <el-button size="small" @click="loadMockKols">加载示例</el-button>
      </div>
      <div v-else class="kol-grid">
        <div v-for="kol in kols" :key="kol.id" class="kol-card">
          <div class="kol-card__avatar">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div class="kol-card__info">
            <div class="kol-card__name">{{ kol.name }}</div>
            <PlatformTag :platform="kol.platform" :label="kol.platform" />
          </div>
          <div class="kol-card__stats">
            <div class="kol-stat">
              <span class="kol-stat__value">{{ kol.totalMentions }}</span>
              <span class="kol-stat__label">提及</span>
            </div>
            <div class="kol-stat">
              <span class="kol-stat__value">{{ kol.influenceScore }}</span>
              <span class="kol-stat__label">影响力</span>
            </div>
          </div>
          <div class="kol-card__engagement">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {{ formatKolNum(kol.totalEngagement) }}
          </div>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import * as echarts from 'echarts';
import http from '@/utils/http';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';

interface GraphNode {
  id: number;
  title: string;
  platform: string;
  author: string;
  publishTime: string;
  sentiment: string;
  readCount: number;
}

interface GraphLink {
  source: number;
  target: number;
  relationType: string;
  similarity: number;
}

interface TaskItem {
  id: number;
  name: string;
}

interface KolProfile {
  id: string;
  name: string;
  platform: string;
  totalMentions: number;
  totalEngagement: number;
  influenceScore: number;
}

const chartEl = ref<HTMLElement>();
const selectedTaskId = ref<number | null>(null);
const timeWindow = ref<number>(24);
const loading = ref(false);
const tasks = ref<TaskItem[]>([]);
const nodes = ref<GraphNode[]>([]);
const links = ref<GraphLink[]>([]);
const isDemo = ref(false);
const kols = ref<KolProfile[]>([]);

let chartInstance: echarts.ECharts | null = null;

const PLATFORM_COLORS: Record<string, string> = {
  weibo: '#FF5C5C',
  weixin: '#10B981',
  weixin_video: '#34D399',
  douyin: '#EF4444',
  kuaishou: '#F59E0B',
  xiaohongshu: '#EC4899',
  baijiahao: '#3B82F6',
};

const nodeMap = computed(() => {
  const map: Record<number, GraphNode> = {};
  for (const n of nodes.value) map[n.id] = n;
  return map;
});

const hasData = computed(() => nodes.value.length > 0);

const linkDetails = computed(() => {
  return links.value.map((l) => {
    const src = nodeMap.value[l.source];
    const tgt = nodeMap.value[l.target];
    return {
      sourcePlatform: src?.platform || '',
      sourceTitle: src?.title || '',
      targetPlatform: tgt?.platform || '',
      targetTitle: tgt?.title || '',
      relationType: l.relationType,
      similarity: l.similarity,
    };
  });
});

onMounted(async () => {
  try {
    const data = await http.get('/monitor-tasks') as TaskItem[];
    tasks.value = data;
    if (data.length > 0) {
      selectedTaskId.value = data[0].id;
      await loadGraph();
    }
  } catch {
    // no tasks
  }
});

watch(chartEl, () => {
  if (chartEl.value && hasData.value) {
    nextTick(() => renderChart());
  }
});

async function loadGraph() {
  if (!selectedTaskId.value) return;
  loading.value = true;
  isDemo.value = false;
  try {
    const res = await http.get(`/propagation/graph/${selectedTaskId.value}`, {
      params: { hours: timeWindow.value, limit: 50 },
    }) as { nodes: GraphNode[]; links: GraphLink[] };
    nodes.value = res.nodes || [];
    links.value = res.links || [];
    await nextTick();
    renderChart();
    loadKols();
  } catch {
    nodes.value = [];
    links.value = [];
  } finally {
    loading.value = false;
  }
}

async function showDemo() {
  loading.value = true;
  isDemo.value = true;
  try {
    const res = await http.get('/propagation/demo') as { nodes: GraphNode[]; links: GraphLink[] };
    nodes.value = res.nodes || [];
    links.value = res.links || [];
    await nextTick();
    renderChart();
    loadMockKols();
  } catch {
    nodes.value = [];
    links.value = [];
  } finally {
    loading.value = false;
  }
}

function exportGraph() {
  const data = JSON.stringify({ nodes: nodes.value, links: links.value }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `propagation-graph-${selectedTaskId.value || 'demo'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatKolNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

async function loadKols() {
  if (!selectedTaskId.value) return;
  try {
    const data = await http.get('/kol/top', {
      params: { taskIds: selectedTaskId.value, days: timeWindow.value, limit: 10 },
    }) as KolProfile[];
    kols.value = data || [];
  } catch {
    kols.value = [];
  }
}

async function loadMockKols() {
  try {
    const data = await http.get('/kol/mock') as KolProfile[];
    kols.value = data || [];
  } catch {
    kols.value = [
      { id: '1', name: '热门话题君', platform: 'weibo', totalMentions: 156, totalEngagement: 850000, influenceScore: 92 },
      { id: '2', name: '科技早报', platform: 'weixin', totalMentions: 89, totalEngagement: 320000, influenceScore: 85 },
      { id: '3', name: '消费预警', platform: 'douyin', totalMentions: 203, totalEngagement: 1200000, influenceScore: 95 },
      { id: '4', name: '品牌观察', platform: 'xiaohongshu', totalMentions: 112, totalEngagement: 280000, influenceScore: 88 },
    ];
  }
}

function renderChart() {
  if (!chartEl.value) return;
  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(chartEl.value);

  const eNodes = nodes.value.map((n) => ({
    id: String(n.id),
    name: n.title.length > 20 ? n.title.substring(0, 20) + '...' : n.title,
    value: n.readCount,
    symbolSize: Math.max(20, Math.min(60, Math.sqrt(n.readCount) * 0.2)),
    itemStyle: {
      color: PLATFORM_COLORS[n.platform] || '#6B7280',
      shadowBlur: 10,
      shadowColor: (PLATFORM_COLORS[n.platform] || '#6B7280') + '66',
    },
    label: { show: true, fontSize: 10, color: '#E8EBFF', formatter: n.platform },
    tooltip: {
      formatter: `<div style="max-width:300px">
        <div style="font-weight:600;margin-bottom:4px">${n.title}</div>
        <div>平台: ${n.platform}</div>
        <div>作者: ${n.author}</div>
        <div>时间: ${new Date(n.publishTime).toLocaleString()}</div>
        <div>情感: ${n.sentiment === 'positive' ? '正面' : n.sentiment === 'negative' ? '负面' : '中性'}</div>
        <div>阅读量: ${n.readCount.toLocaleString()}</div>
      </div>`,
    },
  }));

  const eLinks = links.value.map((l) => ({
    source: String(l.source),
    target: String(l.target),
    value: l.similarity,
    lineStyle: {
      width: Math.max(1, l.similarity * 4),
      curveness: 0.2,
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: PLATFORM_COLORS[nodeMap.value[l.source]?.platform] || '#6B7280' },
          { offset: 1, color: PLATFORM_COLORS[nodeMap.value[l.target]?.platform] || '#6B7280' },
        ],
      },
    },
  }));

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'graph',
      layout: 'force',
      force: {
        repulsion: 500,
        edgeLength: [80, 200],
        layoutAnimation: true,
      },
      roam: true,
      draggable: true,
      data: eNodes,
      edges: eLinks,
      categories: Object.entries(PLATFORM_COLORS).map(([name, color]) => ({
        name,
        itemStyle: { color },
      })),
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [0, 10],
      label: { show: true, position: 'bottom', fontSize: 10, color: '#9DA8E5' },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 4 },
      },
      lineStyle: { color: 'source', curveness: 0.2 },
    }],
  };

  chartInstance.setOption(option);
  const resize = () => chartInstance?.resize();
  window.addEventListener('resize', resize);
}
</script>

<style scoped>
.page-guide {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 16px;
  line-height: 1.5;
}
.propagation-page {
  max-width: 1400px;
  margin: 0 auto;
}

.graph-container {
  position: relative;
  min-height: 500px;
}

.chart {
  width: 100%;
  height: 600px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
}

.empty-state__icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.empty-state__text {
  font-size: 16px;
  color: var(--text-tertiary);
}

.kol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.kol-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.kol-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.kol-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(94, 114, 228, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #A5B4FC;
  flex-shrink: 0;
}

.kol-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.kol-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kol-card__stats {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.kol-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.kol-stat__value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.kol-stat__label {
  font-size: 10px;
  color: var(--text-tertiary);
}

.kol-card__engagement {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
</style>
