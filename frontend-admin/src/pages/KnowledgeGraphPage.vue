<template>
  <div class="knowledge-graph-page">
    <PageHeader title="行业知识图谱" subtitle="提取实体与关系，可视化舆情知识网络">
      <template #actions>
        <div class="kg-controls">
          <el-tag v-if="activeModel?.primary" type="success" size="small" effect="dark">
            主模型 {{ activeModel.primary.name }} ({{ activeModel.primary.provider }})
          </el-tag>
          <el-tag v-if="activeModel?.fallback?.length" type="info" size="small">
            备用 {{ activeModel.fallback.length }} 个
          </el-tag>
          <el-tag v-else type="info" size="small">未配置 LLM</el-tag>
          <el-select v-model="timeRange" size="small" style="width: 100px">
            <el-option label="24小时" :value="24" />
            <el-option label="7天" :value="168" />
            <el-option label="30天" :value="720" />
          </el-select>
          <el-input
            v-model="searchQuery"
            size="small"
            placeholder="搜索实体..."
            style="width: 160px"
            clearable
            @keyup.enter="doSearch"
          />
          <el-button size="small" type="primary" :loading="loading" @click="extractGraph">
            提取图谱
          </el-button>
          <el-button size="small" :loading="loading" @click="fetchStats">刷新统计</el-button>
        </div>
      </template>
    </PageHeader>

    <GlassCard title="风险预警" style="margin-bottom: 20px">
      <template #extra>
        <div class="risk-summary">
          <span v-for="l in levelSummary" :key="l.level" class="risk-summary__item" :class="`risk-summary__item--${l.level}`">
            <span class="risk-summary__dot" />{{ l.label }}: {{ l.count }}
          </span>
          <el-button size="small" text type="primary" :loading="loadingWarnings" @click="fetchWarnings">刷新</el-button>
        </div>
      </template>
      <div v-loading="loadingWarnings" class="risk-cards">
        <div v-for="signal in warnings" :key="signal.id" class="risk-card" :class="`risk-card--${signal.level}`" @click="navigateToEvents(signal)">
          <div class="risk-card__header">
            <el-tag :type="levelTagType(signal.level)" size="small" effect="dark">{{ levelLabel(signal.level) }}</el-tag>
            <el-tag :type="typeTagType(signal.type)" size="small">{{ typeLabel(signal.type) }}</el-tag>
            <span class="risk-card__entity">{{ signal.entityName }}</span>
            <span class="risk-card__type-badge">{{ entityTypeLabel(signal.entityType) }}</span>
          </div>
          <div class="risk-card__body">
            <div class="risk-card__desc">{{ signal.description }}</div>
            <div class="risk-card__change" :class="signal.changePercent > 0 ? 'risk-card__change--up' : 'risk-card__change--down'">
              {{ signal.changePercent > 0 ? '+' : '' }}{{ signal.changePercent.toFixed(1) }}%
            </div>
          </div>
          <div class="risk-card__footer">
            <span class="risk-card__action">{{ signal.suggestedAction }}</span>
            <span class="risk-card__events">{{ signal.relatedEvents }} 条相关</span>
          </div>
        </div>
        <el-empty v-if="!loadingWarnings && warnings.length === 0" description="暂无风险信号" />
      </div>
    </GlassCard>

    <div class="kg-layout">
      <div class="kg-main">
        <GlassCard title="知识图谱" bare>
          <div v-loading="loading" class="graph-container">
            <div v-if="!graphData" class="empty-state">
              <div class="empty-state__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>
                </svg>
              </div>
              <div class="empty-state__text">点击"提取图谱"生成知识图谱</div>
              <el-button type="primary" @click="extractGraph">提取图谱</el-button>
            </div>
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

        <GlassCard v-if="stats" title="图谱统计" class="kg-sidebar__card">
          <div class="kg-stats">
            <div class="kg-stats__item">
              <div class="kg-stats__label">实体总数</div>
              <div class="kg-stats__value">{{ stats.totalEntities }}</div>
            </div>
            <div class="kg-stats__item">
              <div class="kg-stats__label">关系总数</div>
              <div class="kg-stats__value">{{ stats.totalRelations }}</div>
            </div>
          </div>
          <div ref="pieChartEl" style="height: 180px; margin-top: 12px" />
          <div class="kg-stats__section-title">中心节点</div>
          <div class="kg-stats__hub-list">
            <div v-for="(item, idx) in stats.topEntities.slice(0, 6)" :key="item.id" class="kg-stats__hub-item">
              <span class="kg-stats__hub-rank">{{ idx + 1 }}</span>
              <span class="kg-stats__hub-name">{{ item.name }}</span>
              <span class="kg-stats__hub-count">{{ item.connections }} 连接</span>
            </div>
          </div>
        </GlassCard>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import http from '@/utils/http';
import { ElMessage } from 'element-plus';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  weight: number;
  sentiment?: string;
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
  relationTypeBreakdown: Record<string, number>;
}

interface RiskSignal {
  id: string;
  level: 'critical' | 'high' | 'medium' | 'low';
  type: 'sentiment_drop' | 'new_threat' | 'spread_risk' | 'volume_spike';
  entityName: string;
  entityType: string;
  description: string;
  currentScore: number;
  previousScore: number;
  changePercent: number;
  relatedEvents: number;
  suggestedAction: string;
  detectedAt: string;
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
const searchQuery = ref('');
const activeModel = ref<{ primary: { id: number; name: string; provider: string } | null; fallback: Array<{ id: number; name: string; provider: string }> } | null>(null);

let chartInstance: echarts.ECharts | null = null;
let pieInstance: echarts.ECharts | null = null;

const selectedNode = ref<GraphNode | null>(null);
const warnings = ref<RiskSignal[]>([]);
const loadingWarnings = ref(false);
let warningTimer: ReturnType<typeof setInterval> | null = null;

const levelSummary = computed(() => {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const w of warnings.value) {
    counts[w.level] = (counts[w.level] || 0) + 1;
  }
  return [
    { level: 'critical', label: '严重', count: counts.critical },
    { level: 'high', label: '高危', count: counts.high },
    { level: 'medium', label: '中等', count: counts.medium },
    { level: 'low', label: '低危', count: counts.low },
  ];
});

function levelLabel(level: string): string {
  return ({ critical: '严重', high: '高危', medium: '中等', low: '低危' } as Record<string, string>)[level] || level;
}

function levelTagType(level: string): 'danger' | 'warning' | 'info' | 'success' {
  return ({ critical: 'danger', high: 'warning', medium: 'info', low: 'success' } as any)[level] || 'info';
}

function typeLabel(type: string): string {
  return ({
    sentiment_drop: '情感骤降',
    new_threat: '新威胁',
    spread_risk: '扩散风险',
    volume_spike: '声量激增',
  } as Record<string, string>)[type] || type;
}

function typeTagType(type: string): 'danger' | 'warning' | 'info' | 'success' {
  return ({ sentiment_drop: 'danger', new_threat: 'danger', spread_risk: 'warning', volume_spike: 'warning' } as any)[type] || 'info';
}

function entityTypeLabel(type: string): string {
  return ({ person: '人物', org: '组织', product: '产品', place: '地点', event: '事件' } as Record<string, string>)[type] || type;
}

async function fetchWarnings(): Promise<void> {
  loadingWarnings.value = true;
  try {
    const resp = await http.get('/knowledge-graph/warnings');
    warnings.value = resp.data;
  } catch {
    warnings.value = getMockRiskSignals();
  } finally {
    loadingWarnings.value = false;
  }
}

function getMockRiskSignals(): RiskSignal[] {
  return [
    {
      id: 'sd-huawei-1', level: 'critical', type: 'sentiment_drop',
      entityName: '华为', entityType: 'org',
      description: '实体 "华为" 情感分数从 0.65 骤降至 -0.42',
      currentScore: -0.42, previousScore: 0.65, changePercent: -164.6,
      relatedEvents: 23,
      suggestedAction: '立即关注 "华为" 相关舆情，排查负面原因并启动应对预案',
      detectedAt: new Date().toISOString(),
    },
    {
      id: 'vs-xiaomi-2', level: 'high', type: 'volume_spike',
      entityName: '小米SU7', entityType: 'product',
      description: '实体 "小米SU7" 提及量从 12 增至 45',
      currentScore: 45, previousScore: 12, changePercent: 275,
      relatedEvents: 45,
      suggestedAction: '监控 "小米SU7" 声量增长趋势，分析增长原因',
      detectedAt: new Date().toISOString(),
    },
    {
      id: 'sr-apple-3', level: 'medium', type: 'spread_risk',
      entityName: '苹果', entityType: 'org',
      description: '实体 "苹果" 关联 8 个节点，存在舆情扩散风险',
      currentScore: 8, previousScore: 0, changePercent: 100,
      relatedEvents: 15,
      suggestedAction: '切断 "苹果" 的关联传播路径，控制舆情扩散范围',
      detectedAt: new Date().toISOString(),
    },
    {
      id: 'nt-chip-4', level: 'high', type: 'new_threat',
      entityName: '芯片制裁', entityType: 'event',
      description: '检测到高风险实体 "芯片制裁" 出现',
      currentScore: 0.8, previousScore: 0, changePercent: 100,
      relatedEvents: 1,
      suggestedAction: '立即分析 "芯片制裁" 对品牌的影响程度并制定应对策略',
      detectedAt: new Date().toISOString(),
    },
  ];
}

function navigateToEvents(signal: RiskSignal): void {
  router.push({ path: '/events', query: { entity: signal.entityName } });
}

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
    activeModel.value = data.primary ? data : null;
  } catch {
    activeModel.value = null;
  }
}

async function extractGraph(): Promise<void> {
  loading.value = true;
  try {
    const resp = await http.post('/knowledge-graph/extract', {
      hours: timeRange.value,
      maxNodes: 60,
    });
    graphData.value = resp.data;
    selectedNode.value = null;
    await nextTick();
    if (graphData.value && graphData.value.nodes.length > 0) {
      renderGraph();
    } else {
      ElMessage.warning('暂无数据，加载示例图谱');
      await loadMockGraph();
    }
  } catch {
    ElMessage.info('使用示例数据展示');
    await loadMockGraph();
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
      { id: 'catl', name: '宁德时代', type: 'org', weight: 35, category: 1 },
      { id: 'nio', name: '蔚来汽车', type: 'org', weight: 30, category: 1 },
      { id: 'xpeng', name: '小鹏汽车', type: 'org', weight: 28, category: 1 },
      { id: 'renzhengfei', name: '任正非', type: 'person', weight: 50, category: 0 },
      { id: 'tim_cook', name: '蒂姆·库克', type: 'person', weight: 45, category: 0 },
      { id: 'lei_jun', name: '雷军', type: 'person', weight: 48, category: 0 },
      { id: 'ma_huateng', name: '马化腾', type: 'person', weight: 42, category: 0 },
      { id: 'zhang_yiming', name: '张一鸣', type: 'person', weight: 38, category: 0 },
      { id: 'li_yanhong', name: '李彦宏', type: 'person', weight: 35, category: 0 },
      { id: 'wang_chuanfu', name: '王传福', type: 'person', weight: 32, category: 0 },
      { id: 'he_xiaopeng', name: '何小鹏', type: 'person', weight: 28, category: 0 },
      { id: 'li_bin', name: '李斌', type: 'person', weight: 26, category: 0 },
      { id: 'yu_chengdong', name: '余承东', type: 'person', weight: 40, category: 0 },
      { id: 'beijing', name: '北京', type: 'place', weight: 35, category: 2 },
      { id: 'shanghai', name: '上海', type: 'place', weight: 30, category: 2 },
      { id: 'shenzhen', name: '深圳', type: 'place', weight: 32, category: 2 },
      { id: 'hangzhou', name: '杭州', type: 'place', weight: 28, category: 2 },
      { id: 'guangzhou', name: '广州', type: 'place', weight: 26, category: 2 },
      { id: 'silicon_valley', name: '硅谷', type: 'place', weight: 30, category: 2 },
      { id: 'mate60', name: 'Mate 60', type: 'product', weight: 48, category: 3 },
      { id: 'iphone15', name: 'iPhone 15', type: 'product', weight: 45, category: 3 },
      { id: 'xiaomi_su7', name: '小米SU7', type: 'product', weight: 42, category: 3 },
      { id: 'wenjie_m9', name: '问界M9', type: 'product', weight: 35, category: 3 },
      { id: 'wechat', name: '微信', type: 'product', weight: 40, category: 3 },
      { id: 'douyin', name: '抖音', type: 'product', weight: 38, category: 3 },
      { id: 'aliyun', name: '阿里云', type: 'product', weight: 35, category: 3 },
      { id: 'baidu_wenxin', name: '文心一言', type: 'product', weight: 30, category: 3 },
      { id: 'kirin_chip', name: '麒麟芯片', type: 'product', weight: 38, category: 3 },
      { id: 'hongmeng', name: '鸿蒙OS', type: 'product', weight: 36, category: 3 },
      { id: 'p7', name: '小鹏P7', type: 'product', weight: 25, category: 3 },
      { id: 'et7', name: '蔚来ET7', type: 'product', weight: 24, category: 3 },
      { id: 'chip_ban', name: '芯片制裁', type: 'event', weight: 40, category: 4 },
      { id: 'ai_competition', name: 'AI大模型竞赛', type: 'event', weight: 38, category: 4 },
      { id: 'ev_price_war', name: '新能源价格战', type: 'event', weight: 35, category: 4 },
      { id: 'tech_independence', name: '科技自主创新', type: 'event', weight: 30, category: 4 },
      { id: 'smart_driving', name: '智能驾驶普及', type: 'event', weight: 28, category: 4 },
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
      { source: 'xiaomi', target: 'ev_price_war', relation: '参与', strength: 0.7 },
      { source: 'xiaomi', target: 'beijing', relation: '总部', strength: 0.75 },
      { source: 'tencent', target: 'ma_huateng', relation: '创始人', strength: 0.85 },
      { source: 'tencent', target: 'wechat', relation: '开发', strength: 0.9 },
      { source: 'tencent', target: 'shenzhen', relation: '总部', strength: 0.8 },
      { source: 'alibaba', target: 'hangzhou', relation: '总部', strength: 0.8 },
      { source: 'alibaba', target: 'aliyun', relation: '旗下', strength: 0.85 },
      { source: 'alibaba', target: 'ai_competition', relation: '参与', strength: 0.65 },
      { source: 'baidu', target: 'li_yanhong', relation: '创始人', strength: 0.8 },
      { source: 'baidu', target: 'baidu_wenxin', relation: '发布', strength: 0.85 },
      { source: 'baidu', target: 'beijing', relation: '总部', strength: 0.75 },
      { source: 'baidu', target: 'ai_competition', relation: '引领', strength: 0.8 },
      { source: 'baidu', target: 'smart_driving', relation: '布局', strength: 0.7 },
      { source: 'bytedance', target: 'zhang_yiming', relation: '创始人', strength: 0.8 },
      { source: 'bytedance', target: 'douyin', relation: '开发', strength: 0.9 },
      { source: 'bytedance', target: 'beijing', relation: '总部', strength: 0.7 },
      { source: 'nio', target: 'li_bin', relation: '创始人', strength: 0.85 },
      { source: 'nio', target: 'et7', relation: '发布', strength: 0.75 },
      { source: 'nio', target: 'ev_price_war', relation: '参与', strength: 0.7 },
      { source: 'nio', target: 'shanghai', relation: '总部', strength: 0.7 },
      { source: 'xpeng', target: 'he_xiaopeng', relation: '创始人', strength: 0.85 },
      { source: 'xpeng', target: 'p7', relation: '发布', strength: 0.75 },
      { source: 'xpeng', target: 'smart_driving', relation: '领先', strength: 0.8 },
      { source: 'xpeng', target: 'guangzhou', relation: '总部', strength: 0.7 },
      { source: 'catl', target: 'wang_chuanfu', relation: '创始人', strength: 0.7 },
      { source: 'catl', target: 'nio', relation: '供应商', strength: 0.6 },
      { source: 'catl', target: 'xpeng', relation: '供应商', strength: 0.55 },
      { source: 'mate60', target: 'kirin_chip', relation: '搭载', strength: 0.8 },
      { source: 'mate60', target: 'hongmeng', relation: '搭载', strength: 0.75 },
      { source: 'mate60', target: 'tech_independence', relation: '标志', strength: 0.75 },
      { source: 'xiaomi_su7', target: 'ev_price_war', relation: '引发', strength: 0.8 },
      { source: 'iphone15', target: 'silicon_valley', relation: '设计于', strength: 0.5 },
      { source: 'hongmeng', target: 'tech_independence', relation: '推动', strength: 0.8 },
      { source: 'kirin_chip', target: 'chip_ban', relation: '突破', strength: 0.85 },
      { source: 'kirin_chip', target: 'tech_independence', relation: '标志', strength: 0.8 },
      { source: 'wenjie_m9', target: 'huawei', relation: '合作', strength: 0.8 },
      { source: 'wenjie_m9', target: 'hongmeng', relation: '搭载', strength: 0.7 },
      { source: 'wechat', target: 'tencent', relation: '旗下', strength: 0.9 },
      { source: 'douyin', target: 'bytedance', relation: '旗下', strength: 0.9 },
      { source: 'chip_ban', target: 'tech_independence', relation: '催化', strength: 0.8 },
      { source: 'ai_competition', target: 'tech_independence', relation: '推动', strength: 0.7 },
      { source: 'ev_price_war', target: 'smart_driving', relation: '加速', strength: 0.6 },
      { source: 'renzhengfei', target: 'tech_independence', relation: '倡导', strength: 0.8 },
      { source: 'lei_jun', target: 'xiaomi_su7', relation: '发布', strength: 0.8 },
      { source: 'yu_chengdong', target: 'mate60', relation: '发布', strength: 0.7 },
      { source: 'ev_price_war', target: 'xiaomi_su7', relation: '影响', strength: 0.6 },
      { source: 'wenjie_m9', target: 'smart_driving', relation: '搭载', strength: 0.75 },
      { source: 'douyin', target: 'ai_competition', relation: '应用', strength: 0.5 },
      { source: 'alibaba', target: 'digital_trade', relation: '受影响', strength: 0.5 },
      { source: 'chip_ban', target: 'digital_trade', relation: '体现', strength: 0.6 },
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
  await nextTick();
  renderGraph();
}

function renderGraph(): void {
  if (!chartEl.value || !graphData.value) return;

  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value);
  }

  const { nodes, edges, categories } = graphData.value;

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `<strong>${params.name}</strong><br/>类型: ${categories[params.data.category]?.name || '未知'}<br/>权重: ${params.data.value?.toFixed(1)}`;
        }
        return `${params.data.sourceName} → ${params.data.targetName}<br/>关系: ${params.data.relation}`;
      },
      backgroundColor: 'rgba(20,25,56,0.95)',
      borderColor: 'rgba(94,114,228,0.3)',
      textStyle: { color: '#E8EBFF', fontSize: 12 },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 500,
          edgeLength: [50, 200],
          friction: 0.1,
          gravity: 0.1,
        },
        roam: true,
        draggable: true,
        data: nodes.map(n => ({
          id: n.id,
          name: n.name,
          value: n.weight,
          itemStyle: { color: CATEGORY_COLORS[n.category] },
          symbolSize: Math.max(12, Math.min(60, n.weight * 0.9)),
          category: n.category,
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          relation: e.relation,
          lineStyle: { width: e.strength * 4 + 1, curveness: 0.2, color: 'rgba(148,163,184,0.5)' },
          label: { show: e.strength > 0.7, formatter: e.relation, fontSize: 9, color: '#9DA8E5' },
        })),
        categories: categories.map((c, i) => ({
          name: c.name,
          itemStyle: { color: CATEGORY_COLORS[i] },
        })),
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: '#E8EBFF',
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowBlur: 4,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4, color: '#5E72E4' },
        },
        lineStyle: {
          color: 'source',
          curveness: 0.2,
          width: 2,
        },
        zoom: 1,
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
      },
    ],
  };

  chartInstance.setOption(option, true);
  chartInstance.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const node = nodes.find(n => n.id === params.data.id);
      if (node) selectedNode.value = node;
    }
  });
}

async function doSearch(): Promise<void> {
  if (!searchQuery.value.trim()) return;
  loading.value = true;
  try {
    const resp = await http.post('/knowledge-graph/search', { query: searchQuery.value });
    graphData.value = resp.data;
    selectedNode.value = null;
    await nextTick();
    if (graphData.value && graphData.value.nodes.length > 0) {
      renderGraph();
    } else {
      ElMessage.warning('未找到匹配的实体');
    }
  } catch {
    if (graphData.value) {
      const q = searchQuery.value.toLowerCase();
      const matched = graphData.value.nodes.filter(n => n.name.toLowerCase().includes(q));
      if (matched.length > 0) {
        const matchedIds = new Set(matched.map(n => n.id));
        const relatedNodes = new Set<string>(matchedIds);
        const relatedEdges = graphData.value.edges.filter(e => {
          if (matchedIds.has(e.source) || matchedIds.has(e.target)) {
            relatedNodes.add(e.source);
            relatedNodes.add(e.target);
            return true;
          }
          return false;
        });
        graphData.value = {
          nodes: graphData.value.nodes.filter(n => relatedNodes.has(n.id)),
          edges: relatedEdges,
          categories: graphData.value.categories,
        };
        selectedNode.value = null;
        await nextTick();
        renderGraph();
      }
    }
  } finally {
    loading.value = false;
  }
}

async function fetchStats(): Promise<void> {
  try {
    const resp = await http.get('/knowledge-graph/stats');
    stats.value = resp.data;
    await nextTick();
    renderPieChart();
  } catch {
    if (graphData.value) {
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
        relationTypeBreakdown: {},
      };
      await nextTick();
      renderPieChart();
    }
  }
}

function renderPieChart(): void {
  if (!pieChartEl.value || !stats.value) return;
  if (!pieInstance) {
    pieInstance = echarts.init(pieChartEl.value);
  }
  const data = Object.entries(stats.value.entityTypeBreakdown).map(([name, value]) => ({
    name,
    value,
    itemStyle: { color: CATEGORY_COLORS[CATEGORY_NAMES.indexOf(name)] || '#666' },
  }));
  pieInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '50%'],
      data,
      label: { color: '#9DA8E5', fontSize: 10, formatter: '{b}: {c}' },
      labelLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
    }],
  }, true);
}

onMounted(() => {
  extractGraph();
  fetchActiveModel();
  fetchWarnings();
  warningTimer = setInterval(fetchWarnings, 60000);
});

onUnmounted(() => {
  if (warningTimer) {
    clearInterval(warningTimer);
    warningTimer = null;
  }
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  if (pieInstance) {
    pieInstance.dispose();
    pieInstance = null;
  }
});
</script>

<style scoped>
.knowledge-graph-page {
  min-height: calc(100vh - 120px);
}

.kg-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.kg-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}

.kg-main {
  min-height: 600px;
}

.graph-container {
  position: relative;
  width: 100%;
  height: 700px;
}

.chart {
  width: 100%;
  height: 700px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--text-tertiary);
  gap: 16px;
}

.empty-state__icon {
  opacity: 0.4;
}

.empty-state__text {
  font-size: 15px;
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

.entity-detail__section {
  margin-bottom: 12px;
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

.kg-stats__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.kg-stats__hub-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kg-stats__hub-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  font-size: 13px;
}

.kg-stats__hub-rank {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kg-stats__hub-name {
  color: var(--text-primary);
  flex: 1;
  font-weight: 500;
}

.kg-stats__hub-count {
  color: var(--text-tertiary);
  font-size: 11px;
}

.risk-summary {
  display: flex;
  gap: 16px;
  align-items: center;
}

.risk-summary__item {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.risk-summary__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.risk-summary__item--critical .risk-summary__dot { background: var(--color-danger); }
.risk-summary__item--high .risk-summary__dot { background: var(--color-warning); }
.risk-summary__item--medium .risk-summary__dot { background: var(--color-info); }
.risk-summary__item--low .risk-summary__dot { background: var(--color-success); }

.risk-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.risk-card {
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  border-left: 4px solid var(--border-subtle);
  transition: transform 0.15s, box-shadow 0.15s;
}

.risk-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.risk-card--critical { border-left-color: var(--color-danger); }
.risk-card--high { border-left-color: var(--color-warning); }
.risk-card--medium { border-left-color: var(--color-info); }
.risk-card--low { border-left-color: var(--color-success); }

.risk-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.risk-card__entity {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.risk-card__type-badge {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  padding: 1px 6px;
  border-radius: 4px;
}

.risk-card__body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.risk-card__desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  flex: 1;
}

.risk-card__change {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.risk-card__change--up { color: var(--color-danger); }
.risk-card__change--down { color: var(--color-success); }

.risk-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.risk-card__action {
  font-size: 12px;
  color: var(--color-primary);
}

.risk-card__events {
  font-size: 11px;
  color: var(--text-tertiary);
}

@media (max-width: 1024px) {
  .kg-layout {
    grid-template-columns: 1fr;
  }
}
</style>
