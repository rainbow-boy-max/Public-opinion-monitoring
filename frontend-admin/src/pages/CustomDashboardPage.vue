<template>
  <div class="custom-dashboard">
    <div class="dashboard-header">
      <div class="dashboard-header__left">
        <input v-if="editMode" v-model="dashboardName" class="dashboard-title-input" placeholder="仪表盘名称" />
        <h2 v-else class="dashboard-title">{{ dashboardName }}</h2>
        <el-select v-model="currentDashboardId" size="small" style="width: 200px; margin-left: 12px" @change="loadDashboard">
          <el-option v-for="d in dashboards" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </div>
      <div class="dashboard-header__right">
        <el-button size="small" @click="showNewDialog = true">+ 新建仪表盘</el-button>
        <el-button size="small" :type="editMode ? 'warning' : 'default'" @click="toggleEditMode">
          {{ editMode ? '完成编辑' : '编辑模式' }}
        </el-button>
        <el-button v-if="editMode && activeWidgets.length > 0" size="small" type="danger" plain @click="confirmClear">
          清空面板
        </el-button>
      </div>
    </div>

    <div v-if="editMode" class="widget-palette">
      <div class="widget-palette__title">组件列表</div>
      <div class="widget-palette__grid">
        <div
          v-for="wt in widgetTypes"
          :key="wt.type"
          class="palette-card"
          :class="{ 'palette-card--added': activeWidgets.find(w => w.type === wt.type) }"
          @click="addWidget(wt.type)"
        >
          <div class="palette-card__icon">{{ wt.icon }}</div>
          <div class="palette-card__name">{{ wt.label }}</div>
          <div class="palette-card__desc">{{ wt.desc }}</div>
        </div>
      </div>
    </div>

    <div v-if="activeWidgets.length === 0" class="dashboard-empty">
      <div class="dashboard-empty__icon">📊</div>
      <div class="dashboard-empty__text">{{ editMode ? '点击上方组件列表添加组件' : '暂无组件，进入编辑模式添加' }}</div>
    </div>

    <div v-else class="dashboard-grid" :class="{ 'dashboard-grid--editing': editMode }">
      <div
        v-for="(widget, idx) in activeWidgets"
        :key="widget.type"
        class="widget-card"
        :style="{ order: idx }"
      >
        <div class="widget-card__header">
          <div class="widget-card__title">
            <span class="widget-card__icon">{{ widgetTypesMap[widget.type]?.icon }}</span>
            {{ widgetTypesMap[widget.type]?.label || widget.type }}
          </div>
          <div class="widget-card__actions" v-if="editMode">
            <el-tooltip content="设置" placement="top">
              <el-button size="small" text @click="openWidgetConfig(widget)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </el-button>
            </el-tooltip>
            <el-tooltip content="上移" placement="top">
              <el-button size="small" text :disabled="idx === 0" @click="moveWidget(idx, -1)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              </el-button>
            </el-tooltip>
            <el-tooltip content="下移" placement="top">
              <el-button size="small" text :disabled="idx === activeWidgets.length - 1" @click="moveWidget(idx, 1)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </el-button>
            </el-tooltip>
            <el-tooltip content="移除" placement="top">
              <el-button size="small" text type="danger" @click="removeWidget(idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="widget-card__body">
          <div v-if="widget.loading" class="widget-loading">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          </div>
          <div v-else-if="widget.error" class="widget-error">
            <span>加载失败</span>
            <el-button size="small" text @click="loadWidgetData(widget)">重试</el-button>
          </div>
          <template v-else>
            <SentimentTrend v-if="widget.type === 'sentiment_trend'" :data="widget.data" />
            <PlatformBreakdown v-else-if="widget.type === 'platform_breakdown'" :data="widget.data" />
            <VolumeOverTime v-else-if="widget.type === 'volume_over_time'" :data="widget.data" />
            <TopKeywords v-else-if="widget.type === 'top_keywords'" :data="widget.data" />
            <RecentEvents v-else-if="widget.type === 'recent_events'" :data="widget.data" />
            <SentimentGauge v-else-if="widget.type === 'sentiment_gauge'" :data="widget.data" />
            <HotTopicsWidget v-else-if="widget.type === 'hot_topics'" :data="widget.data" />
          </template>
        </div>
      </div>
    </div>

    <el-dialog v-model="showNewDialog" title="新建仪表盘" width="400px">
      <el-form @submit.prevent="createDashboard">
        <el-form-item label="名称">
          <el-input v-model="newDashboardName" placeholder="输入仪表盘名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" @click="createDashboard">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showConfigDialog" title="组件配置" width="400px">
      <el-form v-if="configWidget" label-width="100px">
        <el-form-item label="时间范围">
          <el-select v-model="configWidget.config.timeRange">
            <el-option label="最近 6 小时" value="6h" />
            <el-option label="最近 24 小时" value="24h" />
            <el-option label="最近 7 天" value="7d" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button type="primary" @click="saveWidgetConfig">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import http from '@/utils/http';
import SentimentTrend from './widgets/SentimentTrend.vue';
import PlatformBreakdown from './widgets/PlatformBreakdown.vue';
import VolumeOverTime from './widgets/VolumeOverTime.vue';
import TopKeywords from './widgets/TopKeywords.vue';
import RecentEvents from './widgets/RecentEvents.vue';
import SentimentGauge from './widgets/SentimentGauge.vue';
import HotTopicsWidget from './widgets/HotTopicsWidget.vue';

interface WidgetConfig {
  timeRange: string;
}

interface DashboardWidget {
  type: string;
  config: WidgetConfig;
  data: any;
  loading: boolean;
  error: boolean;
}

interface DashboardData {
  id: number;
  name: string;
  layout: string;
  widgets: string;
  isDefault: number;
}

const WIDGET_TYPES = [
  { type: 'sentiment_trend', label: '情感趋势', icon: '📈', desc: '正面/负面/中性随时间变化' },
  { type: 'platform_breakdown', label: '平台分布', icon: '🌐', desc: '各平台事件占比' },
  { type: 'volume_over_time', label: '数量趋势', icon: '📊', desc: '事件数量变化曲线' },
  { type: 'top_keywords', label: '热门关键词', icon: '🏷️', desc: '高频关键词云' },
  { type: 'recent_events', label: '最新事件', icon: '📰', desc: '最新舆情事件列表' },
  { type: 'sentiment_gauge', label: '情感仪表盘', icon: '🎯', desc: '综合情感评分' },
  { type: 'hot_topics', label: '热点话题', icon: '🔥', desc: '当前上升热点' },
];

const widgetTypes = WIDGET_TYPES;
const widgetTypesMap = computed(() => {
  const m: Record<string, { type: string; label: string; icon: string; desc: string }> = {};
  for (const wt of WIDGET_TYPES) m[wt.type] = wt;
  return m;
});

const dashboards = ref<DashboardData[]>([]);
const currentDashboardId = ref<number | null>(null);
const dashboardName = ref('');
const editMode = ref(false);
const activeWidgets = reactive<DashboardWidget[]>([]);
const showNewDialog = ref(false);
const newDashboardName = ref('');
const showConfigDialog = ref(false);
const configWidget = ref<DashboardWidget | null>(null);

let refreshTimer: number | undefined;

async function loadDashboards() {
  try {
    dashboards.value = await http.get('/dashboards') || [];
    if (dashboards.value.length > 0 && !currentDashboardId.value) {
      const def = dashboards.value.find(d => d.isDefault) || dashboards.value[0];
      currentDashboardId.value = def.id;
      await loadDashboard();
    }
  } catch { /* ignore */ }
}

async function loadDashboard() {
  if (!currentDashboardId.value) return;
  try {
    const d = await http.get(`/dashboards/${currentDashboardId.value}`);
    dashboardName.value = d.name;
    const widgets: { type: string; config: WidgetConfig }[] = JSON.parse(d.widgets || '[]');
    activeWidgets.length = 0;
    for (const w of widgets) {
      activeWidgets.push({ ...w, data: null, loading: true, error: false });
    }
    loadAllWidgetData();
  } catch { /* ignore */ }
}

function toggleEditMode() {
  editMode.value = !editMode.value;
  if (!editMode.value) saveCurrentLayout();
}

function addWidget(type: string) {
  if (activeWidgets.find(w => w.type === type)) return;
  const widget: DashboardWidget = { type, config: { timeRange: '24h' }, data: null, loading: true, error: false };
  activeWidgets.push(widget);
  loadWidgetData(widget);
}

function removeWidget(idx: number) {
  activeWidgets.splice(idx, 1);
}

function moveWidget(idx: number, dir: number) {
  const target = idx + dir;
  if (target < 0 || target >= activeWidgets.length) return;
  const tmp = activeWidgets[target];
  activeWidgets[target] = activeWidgets[idx];
  activeWidgets[idx] = tmp;
}

function openWidgetConfig(widget: DashboardWidget) {
  configWidget.value = widget;
  showConfigDialog.value = true;
}

function saveWidgetConfig() {
  showConfigDialog.value = false;
  if (configWidget.value) loadWidgetData(configWidget.value);
}

async function confirmClear() {
  try {
    await ElMessageBox.confirm('确定清空所有组件？', '确认');
    activeWidgets.length = 0;
  } catch { /* ignore */ }
}

function saveCurrentLayout() {
  if (!currentDashboardId.value) return;
  const widgets = activeWidgets.map(w => ({ type: w.type, config: w.config }));
  http.put(`/dashboards/${currentDashboardId.value}`, { widgets: JSON.stringify(widgets) }).catch(() => {});
}

async function loadWidgetData(widget: DashboardWidget) {
  widget.loading = true;
  widget.error = false;
  try {
    const result = await http.post('/dashboards/widget-data', { type: widget.type, config: widget.config });
    widget.data = result;
  } catch {
    widget.error = true;
    widget.data = generateMockData(widget.type);
  } finally {
    widget.loading = false;
  }
}

function loadAllWidgetData() {
  for (const w of activeWidgets) loadWidgetData(w);
}

function generateMockData(type: string): any {
  switch (type) {
    case 'sentiment_trend': {
      const categories: string[] = [];
      for (let i = 0; i < 24; i++) categories.push(`${String(i).padStart(2, '0')}:00`);
      return {
        categories,
        series: [
          { name: '正面', data: categories.map(() => Math.floor(Math.random() * 50 + 20)) },
          { name: '负面', data: categories.map(() => Math.floor(Math.random() * 30 + 10)) },
          { name: '中性', data: categories.map(() => Math.floor(Math.random() * 40 + 15)) },
        ],
      };
    }
    case 'platform_breakdown': {
      const platforms = ['微信', '抖音', '微博', '小红书', '快手', '百家号'];
      return { data: platforms.map(name => ({ name, value: Math.floor(Math.random() * 200 + 30) })) };
    }
    case 'volume_over_time': {
      const categories: string[] = [];
      for (let i = 0; i < 24; i++) categories.push(`${String(i).padStart(2, '0')}:00`);
      return { categories, data: categories.map(() => Math.floor(Math.random() * 80 + 10)) };
    }
    case 'top_keywords': {
      const words = ['舆情', '热点', '事件', '危机', '公关', '品牌', '口碑', '投诉', '维权', '曝光',
        '举报', '监管', '政策', '行业', '市场', '竞争', '创新', '科技', '金融', '教育',
        '医疗', '房产', '汽车', '消费', '电商', '直播', '短视频', '社交', '平台', '数据'];
      return { data: words.slice(0, 20 + Math.floor(Math.random() * 10)).map(text => ({ text, count: Math.floor(Math.random() * 100 + 10) })) };
    }
    case 'recent_events': {
      const platforms = ['weixin', 'douyin', 'weibo', 'xiaohongshu', 'kuaishou', 'baijiahao'];
      const sentiments = ['positive', 'negative', 'neutral'] as const;
      return {
        data: Array.from({ length: 15 }, (_, i) => ({
          id: i,
          title: `全量舆情事件 ${i + 1}`,
          platform: platforms[Math.floor(Math.random() * platforms.length)],
          sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
          matchedAt: new Date(Date.now() - i * 3600000).toISOString(),
          url: '#',
        })),
      };
    }
    case 'sentiment_gauge':
      return { value: Math.floor(Math.random() * 30 + 45), min: 0, max: 100 };
    case 'hot_topics': {
      return {
        data: Array.from({ length: 5 }, (_, i) => ({
          id: `${i}`,
          keywords: [`全量话题${i + 1}`, '热点'],
          currentVolume: Math.floor(Math.random() * 1000 + 100),
          growthRate: Math.floor(Math.random() * 200 - 50),
          platforms: ['微信', '微博'],
          sentimentDistribution: { positive: 0.5, negative: 0.2, neutral: 0.3 },
          score: Math.floor(Math.random() * 100),
          trend: (['rising', 'falling', 'stable'] as const)[Math.floor(Math.random() * 3)],
        })),
      };
    }
    default:
      return {};
  }
}

async function createDashboard() {
  if (!newDashboardName.value.trim()) return;
  try {
    await http.post('/dashboards', { name: newDashboardName.value.trim() });
    newDashboardName.value = '';
    showNewDialog.value = false;
    ElMessage.success('创建成功');
    await loadDashboards();
  } catch { /* ignore */ }
}

onMounted(() => {
  loadDashboards();
  refreshTimer = window.setInterval(loadAllWidgetData, 30000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.custom-dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.dashboard-header__left {
  display: flex;
  align-items: center;
}

.dashboard-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #5E72E4, #7C3AED);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.dashboard-title-input {
  font-size: 22px;
  font-weight: 700;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--color-primary);
  color: var(--text-primary);
  outline: none;
  padding: 0 4px;
  width: 200px;
}

.dashboard-header__right {
  display: flex;
  gap: 8px;
}

.widget-palette {
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.widget-palette__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.widget-palette__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.palette-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  background: rgba(94, 114, 228, 0.06);
  border: 1px solid rgba(140, 155, 240, 0.1);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.palette-card:hover {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.12);
  transform: translateY(-2px);
}

.palette-card--added {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}

.palette-card__icon {
  font-size: 24px;
}

.palette-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.palette-card__desc {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.3;
}

.dashboard-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  gap: 12px;
}

.dashboard-empty__icon {
  font-size: 48px;
  opacity: 0.5;
}

.dashboard-empty__text {
  font-size: 14px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dashboard-grid--editing {
  grid-template-columns: 1fr;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.widget-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.widget-card:hover {
  border-color: rgba(140, 155, 240, 0.2);
}

.widget-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.widget-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.widget-card__icon {
  font-size: 16px;
}

.widget-card__actions {
  display: flex;
  gap: 2px;
}

.widget-card__body {
  padding: 12px;
  min-height: 200px;
  position: relative;
}

.widget-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-tertiary);
}

.widget-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 8px;
  color: var(--text-tertiary);
}
</style>
