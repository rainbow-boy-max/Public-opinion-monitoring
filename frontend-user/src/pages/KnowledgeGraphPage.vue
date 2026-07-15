<template>
  <div class="knowledge-graph-page">
    <PageHeader title="知识图谱" subtitle="舆情实体关系网络">
      <template #actions>
        <div class="kg-controls">
          <el-tag v-if="activeModel" type="success" size="small" effect="dark">
            🧠 {{ activeModel.name }} ({{ activeModel.provider }})
          </el-tag>
          <el-tag v-else type="info" size="small">🧠 未配置 LLM</el-tag>
          <el-select v-model="timeRange" size="small" style="width: 100px">
            <el-option label="24小时" :value="24" />
            <el-option label="7天" :value="168" />
            <el-option label="30天" :value="720" />
          </el-select>
          <el-button size="small" type="primary" :loading="loading" @click="extractGraph">
            提取图谱
          </el-button>
        </div>
      </template>
    </PageHeader>

    <div class="kg-layout">
      <div class="kg-main">
        <GlassCard title="舆情知识图谱" bare>
          <div v-loading="loading" class="graph-container">
            <EmptyStateGuide
              v-if="!graphData && !loading"
              icon="🔗"
              title="暂无图谱数据"
              description="知识图谱基于监控事件中的实体抽取构建，请先创建监控任务"
              primary-action="前往创建监控任务"
              secondary-action="加载示例图谱"
              @primary="router.push('/tasks')"
              @secondary="loadMockGraph"
            />
            <div ref="chartEl" v-show="graphData" class="chart" />
          </div>
        </GlassCard>
      </div>

      <aside class="kg-sidebar">
        <GlassCard v-if="selectedNode" title="实体详情" class="kg-sidebar__card">
          <div class="entity-detail">
            <div class="entity-detail__header">
              <div class="entity-detail__color-dot" :style="{ background: CATEGORY_COLORS[selectedNode.category] }" />
              <div class="entity-detail__info">
                <div class="entity-detail__name">{{ selectedNode.name }}</div>
                <div class="entity-detail__type">{{ CATEGORY_NAMES[selectedNode.category] }}</div>
              </div>
            </div>
            <div class="entity-detail__section">
              <div class="entity-detail__section-title">关联实体</div>
              <div class="entity-detail__connections">
                <div v-for="conn in connectedNodes" :key="conn.id" class="entity-detail__conn-item">
                  <span class="entity-detail__conn-dot" :style="{ background: CATEGORY_COLORS[conn.category] }" />
                  <span class="entity-detail__conn-name">{{ conn.name }}</span>
                  <span class="entity-detail__conn-rel">{{ conn.relation }}</span>
                </div>
                <el-empty v-if="connectedNodes.length === 0" description="无关联实体" />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard v-if="stats" title="统计" class="kg-sidebar__card">
          <div class="kg-stats">
            <div class="kg-stats__item">
              <div class="kg-stats__label">实体</div>
              <div class="kg-stats__value">{{ stats.totalEntities }}</div>
            </div>
            <div class="kg-stats__item">
              <div class="kg-stats__label">关系</div>
              <div class="kg-stats__value">{{ stats.totalRelations }}</div>
            </div>
          </div>
          <div ref="pieChartEl" style="height: 160px; margin-top: 12px" />
        </GlassCard>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import http from '@/utils/http';
import { ElMessage } from 'element-plus';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';
import EmptyStateGuide from '@/components/EmptyStateGuide.vue';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  weight: number;
  category: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  strength: number;
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Array<{ name: string; color: string }>;
}

interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  entityTypeBreakdown: Record<string, number>;
  topEntities: Array<{ id: string; name: string; type: string; connections: number }>;
}

const CATEGORY_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
const CATEGORY_NAMES = ['人物', '组织', '地点', '产品', '事件'];

const router = useRouter();

const chartEl = ref<HTMLElement>();
const pieChartEl = ref<HTMLElement>();
const loading = ref(false);
const graphData = ref<KnowledgeGraph | null>(null);
const stats = ref<GraphStats | null>(null);
const timeRange = ref(168);
const activeModel = ref<{ name: string; provider: string } | null>(null);

let chartInstance: echarts.ECharts | null = null;
let pieInstance: echarts.ECharts | null = null;

const selectedNode = ref<GraphNode | null>(null);
const connectedNodes = computed(() => {
  if (!selectedNode.value || !graphData.value) return [];
  const nodeId = selectedNode.value.id;
  const result: Array<{ id: string; name: string; category: number; relation: string }> = [];
  for (const edge of graphData.value.edges) {
    if (edge.source === nodeId) {
      const target = graphData.value.nodes.find(n => n.id === edge.target);
      if (target) result.push({ id: target.id, name: target.name, category: target.category, relation: edge.relation });
    } else if (edge.target === nodeId) {
      const source = graphData.value.nodes.find(n => n.id === edge.source);
      if (source) result.push({ id: source.id, name: source.name, category: source.category, relation: edge.relation });
    }
  }
  return result;
});

async function fetchActiveModel(): Promise<void> {
  try {
    const data = await http.get('/knowledge-graph/active-model');
    activeModel.value = data.name ? data : null;
  } catch {
    activeModel.value = null;
  }
}

async function extractGraph(): Promise<void> {
  loading.value = true;
  try {
    const resp = await http.post('/knowledge-graph/extract', { hours: timeRange.value });
    graphData.value = resp.data;
    await nextTick();
    if (graphData.value && graphData.value.nodes.length > 0) {
      renderGraph();
      fetchStats();
    } else {
      loadMockGraph();
    }
  } catch {
    loadMockGraph();
  } finally {
    loading.value = false;
  }
}

async function loadMockGraph(): Promise<void> {
  const mock: KnowledgeGraph = {
    nodes: [
      { id: 'huawei', name: '华为', type: 'org', weight: 60, category: 1 },
      { id: 'apple', name: '苹果', type: 'org', weight: 55, category: 1 },
      { id: 'xiaomi', name: '小米', type: 'org', weight: 45, category: 1 },
      { id: 'tencent', name: '腾讯', type: 'org', weight: 50, category: 1 },
      { id: 'alibaba', name: '阿里巴巴', type: 'org', weight: 50, category: 1 },
      { id: 'baidu', name: '百度', type: 'org', weight: 40, category: 1 },
      { id: 'bytedance', name: '字节跳动', type: 'org', weight: 45, category: 1 },
      { id: 'nio', name: '蔚来汽车', type: 'org', weight: 30, category: 1 },
      { id: 'xpeng', name: '小鹏汽车', type: 'org', weight: 28, category: 1 },
      { id: 'renzhengfei', name: '任正非', type: 'person', weight: 50, category: 0 },
      { id: 'tim_cook', name: '蒂姆·库克', type: 'person', weight: 45, category: 0 },
      { id: 'lei_jun', name: '雷军', type: 'person', weight: 48, category: 0 },
      { id: 'ma_huateng', name: '马化腾', type: 'person', weight: 42, category: 0 },
      { id: 'zhang_yiming', name: '张一鸣', type: 'person', weight: 38, category: 0 },
      { id: 'li_yanhong', name: '李彦宏', type: 'person', weight: 35, category: 0 },
      { id: 'he_xiaopeng', name: '何小鹏', type: 'person', weight: 28, category: 0 },
      { id: 'li_bin', name: '李斌', type: 'person', weight: 26, category: 0 },
      { id: 'yu_chengdong', name: '余承东', type: 'person', weight: 40, category: 0 },
      { id: 'beijing', name: '北京', type: 'place', weight: 35, category: 2 },
      { id: 'shanghai', name: '上海', type: 'place', weight: 30, category: 2 },
      { id: 'shenzhen', name: '深圳', type: 'place', weight: 32, category: 2 },
      { id: 'hangzhou', name: '杭州', type: 'place', weight: 28, category: 2 },
      { id: 'silicon_valley', name: '硅谷', type: 'place', weight: 30, category: 2 },
      { id: 'mate60', name: 'Mate 60', type: 'product', weight: 48, category: 3 },
      { id: 'iphone15', name: 'iPhone 15', type: 'product', weight: 45, category: 3 },
      { id: 'xiaomi_su7', name: '小米SU7', type: 'product', weight: 42, category: 3 },
      { id: 'wechat', name: '微信', type: 'product', weight: 40, category: 3 },
      { id: 'douyin', name: '抖音', type: 'product', weight: 38, category: 3 },
      { id: 'kirin_chip', name: '麒麟芯片', type: 'product', weight: 38, category: 3 },
      { id: 'hongmeng', name: '鸿蒙OS', type: 'product', weight: 36, category: 3 },
      { id: 'chip_ban', name: '芯片制裁', type: 'event', weight: 40, category: 4 },
      { id: 'ai_competition', name: 'AI大模型竞赛', type: 'event', weight: 38, category: 4 },
      { id: 'ev_price_war', name: '新能源价格战', type: 'event', weight: 35, category: 4 },
      { id: 'tech_independence', name: '科技自主创新', type: 'event', weight: 30, category: 4 },
      { id: 'smart_driving', name: '智能驾驶', type: 'event', weight: 28, category: 4 },
    ],
    edges: [
      { source: 'huawei', target: 'renzhengfei', relation: '创始人', strength: 0.9 },
      { source: 'huawei', target: 'yu_chengdong', relation: '高管', strength: 0.8 },
      { source: 'huawei', target: 'mate60', relation: '发布', strength: 0.8 },
      { source: 'huawei', target: 'kirin_chip', relation: '自研', strength: 0.9 },
      { source: 'huawei', target: 'hongmeng', relation: '开发', strength: 0.85 },
      { source: 'huawei', target: 'chip_ban', relation: '受影响', strength: 0.7 },
      { source: 'huawei', target: 'tech_independence', relation: '推动', strength: 0.75 },
      { source: 'huawei', target: 'shenzhen', relation: '总部', strength: 0.8 },
      { source: 'apple', target: 'tim_cook', relation: 'CEO', strength: 0.85 },
      { source: 'apple', target: 'iphone15', relation: '发布', strength: 0.8 },
      { source: 'apple', target: 'silicon_valley', relation: '总部', strength: 0.7 },
      { source: 'xiaomi', target: 'lei_jun', relation: '创始人', strength: 0.9 },
      { source: 'xiaomi', target: 'xiaomi_su7', relation: '发布', strength: 0.85 },
      { source: 'xiaomi', target: 'beijing', relation: '总部', strength: 0.75 },
      { source: 'tencent', target: 'ma_huateng', relation: '创始人', strength: 0.85 },
      { source: 'tencent', target: 'wechat', relation: '开发', strength: 0.9 },
      { source: 'tencent', target: 'shenzhen', relation: '总部', strength: 0.8 },
      { source: 'alibaba', target: 'hangzhou', relation: '总部', strength: 0.8 },
      { source: 'baidu', target: 'li_yanhong', relation: '创始人', strength: 0.8 },
      { source: 'baidu', target: 'beijing', relation: '总部', strength: 0.75 },
      { source: 'baidu', target: 'ai_competition', relation: '引领', strength: 0.8 },
      { source: 'baidu', target: 'smart_driving', relation: '布局', strength: 0.7 },
      { source: 'bytedance', target: 'zhang_yiming', relation: '创始人', strength: 0.8 },
      { source: 'bytedance', target: 'douyin', relation: '开发', strength: 0.9 },
      { source: 'nio', target: 'li_bin', relation: '创始人', strength: 0.85 },
      { source: 'nio', target: 'ev_price_war', relation: '参与', strength: 0.7 },
      { source: 'nio', target: 'shanghai', relation: '总部', strength: 0.7 },
      { source: 'xpeng', target: 'he_xiaopeng', relation: '创始人', strength: 0.85 },
      { source: 'xpeng', target: 'smart_driving', relation: '领先', strength: 0.8 },
      { source: 'mate60', target: 'kirin_chip', relation: '搭载', strength: 0.8 },
      { source: 'mate60', target: 'hongmeng', relation: '搭载', strength: 0.75 },
      { source: 'mate60', target: 'tech_independence', relation: '标志', strength: 0.75 },
      { source: 'xiaomi_su7', target: 'ev_price_war', relation: '引发', strength: 0.8 },
      { source: 'hongmeng', target: 'tech_independence', relation: '推动', strength: 0.8 },
      { source: 'kirin_chip', target: 'chip_ban', relation: '突破', strength: 0.85 },
      { source: 'kirin_chip', target: 'tech_independence', relation: '标志', strength: 0.8 },
      { source: 'wechat', target: 'tencent', relation: '旗下', strength: 0.9 },
      { source: 'douyin', target: 'bytedance', relation: '旗下', strength: 0.9 },
      { source: 'chip_ban', target: 'tech_independence', relation: '催化', strength: 0.8 },
      { source: 'ai_competition', target: 'tech_independence', relation: '推动', strength: 0.7 },
      { source: 'ev_price_war', target: 'smart_driving', relation: '加速', strength: 0.6 },
      { source: 'renzhengfei', target: 'tech_independence', relation: '倡导', strength: 0.8 },
      { source: 'lei_jun', target: 'xiaomi_su7', relation: '发布', strength: 0.8 },
      { source: 'yu_chengdong', target: 'mate60', relation: '发布', strength: 0.7 },
    ],
    categories: [
      { name: '人物', color: '#EF4444' },
      { name: '组织', color: '#3B82F6' },
      { name: '地点', color: '#10B981' },
      { name: '产品', color: '#F59E0B' },
      { name: '事件', color: '#8B5CF6' },
    ],
  };
  graphData.value = mock;
  ElMessage.info('使用示例数据展示');
  await nextTick();
  renderGraph();
  buildStats();
}

function renderGraph(): void {
  if (!chartEl.value || !graphData.value) return;
  if (!chartInstance) chartInstance = echarts.init(chartEl.value);

  const { nodes, edges, categories } = graphData.value;

  chartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `<strong>${params.name}</strong><br/>类型: ${categories[params.data.category]?.name || '未知'}`;
        }
        return `${params.data.sourceName} → ${params.data.targetName}<br/>${params.data.relation}`;
      },
      backgroundColor: 'rgba(20,25,56,0.95)',
      borderColor: 'rgba(94,114,228,0.3)',
      textStyle: { color: '#E8EBFF' },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      force: { repulsion: 500, edgeLength: [50, 200], friction: 0.1, gravity: 0.1 },
      roam: true,
      draggable: true,
      data: nodes.map(n => ({
        id: n.id, name: n.name, value: n.weight,
        itemStyle: { color: CATEGORY_COLORS[n.category] },
        symbolSize: Math.max(12, Math.min(55, n.weight * 0.8)),
        category: n.category,
      })),
      edges: edges.map(e => ({
        source: e.source, target: e.target,
        lineStyle: { width: e.strength * 3 + 1, curveness: 0.2, color: 'rgba(148,163,184,0.4)' },
        label: { show: e.strength > 0.75, formatter: e.relation, fontSize: 9, color: '#9DA8E5' },
      })),
      categories: categories.map((c, i) => ({ name: c.name, itemStyle: { color: CATEGORY_COLORS[i] } })),
      label: { show: true, position: 'right', fontSize: 10, color: '#E8EBFF', textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 4, color: '#5E72E4' } },
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
    }],
  }, true);

  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const node = nodes.find(n => n.id === params.data.id);
      if (node) selectedNode.value = node;
    }
  });
}

function buildStats(): void {
  if (!graphData.value) return;
  const typeBreakdown: Record<string, number> = {};
  for (const n of graphData.value.nodes) {
    const typeName = CATEGORY_NAMES[n.category];
    typeBreakdown[typeName] = (typeBreakdown[typeName] || 0) + 1;
  }
  const connectionCount = new Map<string, number>();
  for (const e of graphData.value.edges) {
    connectionCount.set(e.source, (connectionCount.get(e.source) || 0) + 1);
    connectionCount.set(e.target, (connectionCount.get(e.target) || 0) + 1);
  }
  const topEntities = [...connectionCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => {
      const node = graphData.value!.nodes.find(n => n.id === id);
      return { id, name: node?.name || id, type: node?.type || 'keyword', connections: count };
    });
  stats.value = {
    totalEntities: graphData.value.nodes.length,
    totalRelations: graphData.value.edges.length,
    entityTypeBreakdown: typeBreakdown,
    topEntities,
  };
  nextTick(() => {
    if (!pieChartEl.value) return;
    if (!pieInstance) pieInstance = echarts.init(pieChartEl.value);
    pieInstance.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
      series: [{
        type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
        data: Object.entries(typeBreakdown).map(([name, value]) => ({
          name, value,
          itemStyle: { color: CATEGORY_COLORS[CATEGORY_NAMES.indexOf(name)] || '#666' },
        })),
        label: { color: '#9DA8E5', fontSize: 10, formatter: '{b}: {c}' },
        labelLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
      }],
    }, true);
  });
}

async function fetchStats(): Promise<void> {
  try {
    const resp = await http.get('/knowledge-graph/stats');
    stats.value = resp.data;
  } catch {
    buildStats();
  }
}

onMounted(() => {
  extractGraph();
  fetchActiveModel();
});

onUnmounted(() => {
  if (chartInstance) { chartInstance.dispose(); chartInstance = null; }
  if (pieInstance) { pieInstance.dispose(); pieInstance = null; }
});
</script>

<style scoped>
.kg-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.kg-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

.graph-container {
  position: relative;
  width: 100%;
  height: 650px;
}

.chart {
  width: 100%;
  height: 650px;
}

.kg-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kg-sidebar__card {
  overflow: hidden;
}

.entity-detail__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.entity-detail__color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.entity-detail__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.entity-detail__type {
  font-size: 12px;
  color: var(--text-tertiary);
}

.entity-detail__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.entity-detail__connections {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entity-detail__conn-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--glass-bg);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.entity-detail__conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.entity-detail__conn-name {
  color: var(--text-primary);
  font-weight: 500;
}

.entity-detail__conn-rel {
  color: var(--text-tertiary);
  font-size: 11px;
  margin-left: auto;
}

.kg-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.kg-stats__item {
  padding: 12px;
  background: var(--glass-bg);
  border-radius: var(--radius-sm);
  text-align: center;
}

.kg-stats__label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.kg-stats__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

@media (max-width: 1024px) {
  .kg-layout {
    grid-template-columns: 1fr;
  }
}
</style>
