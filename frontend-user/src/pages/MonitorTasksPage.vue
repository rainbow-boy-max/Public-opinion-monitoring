<template>
  <GlassCard title="监控任务" icon="🎯" subtitle="关键词 + 平台 + 频率订阅">
    <template #extra>
      <el-button @click="exportTasks">导出CSV</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">创建任务</el-button>
    </template>

    <div class="toolbar">
      <el-tag
        v-for="filter in statusFilters"
        :key="filter.value"
        :type="filterStatus === filter.value ? 'primary' : 'info'"
        effect="dark"
        class="filter-tag"
        @click="filterStatus = filter.value"
      >
        {{ filter.label }} ({{ filter.count }})
      </el-tag>
    </div>

    <el-table :data="filteredTasks" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">#{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="任务名称" min-width="160">
        <template #default="{ row }">
          <div class="task-name">{{ row.name }}</div>
        </template>
      </el-table-column>
      <el-table-column label="关键词" min-width="220">
        <template #default="{ row }">
          <div class="keywords-list">
            <span v-for="kw in parseKeywords(row)" :key="kw" class="keyword-chip">{{ kw }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="平台" width="200">
        <template #default="{ row }">
          <div class="platforms-list">
            <PlatformTag v-for="p in row.platforms" :key="p" :platform="p" :label="platformLabel(p)" />
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="frequency" label="频率" width="100">
        <template #default="{ row }">
          <span class="freq-tag">{{ freqLabel(row.frequency) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" effect="dark">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastRunAt" label="最后运行" width="170">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">{{ formatDate(row.lastRunAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
        <el-button size="small" @click="goDetail(row)">详情</el-button>
        <el-button
          size="small"
          :type="row.status === 'enabled' ? 'warning' : 'success'"
          @click="onToggle(row)"
        >
          {{ row.status === 'enabled' ? '暂停' : '启用' }}
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="row._running"
          @click="onRunNow(row)"
        >
          {{ row._running ? '采集中...' : '立即采集' }}
        </el-button>
        <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyStateGuide v-if="!loading && tasks.length === 0" 
      icon="📡"
      title="暂无监控任务"
      description="创建监控任务后，系统将自动监测各大平台的相关舆情信息"
      primary-action="创建任务"
      @primary="openCreate" />
  </GlassCard>

  <p class="page-guide">创建监控任务后，系统将自动采集各大平台的相关舆情信息</p>

  <el-dialog v-model="dialogVisible" title="创建监控任务" width="640">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="给任务起一个名字" />
      </el-form-item>
      <el-form-item label="任务类型">
        <div class="task-type-grid">
          <div v-for="t in taskTypes" :key="t.id" 
            class="task-type-card" 
            :class="{ 'task-type-card--active': selectedTaskType === t.id }"
            @click="selectTaskType(t.id)">
            <div class="task-type-card__icon">{{ t.icon }}</div>
            <div class="task-type-card__info">
              <div class="task-type-card__name">{{ t.name }}</div>
              <div class="task-type-card__desc">{{ t.desc }}</div>
            </div>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="关键词" prop="keywords">
        <div class="keywords-input-row">
          <el-input
            v-model="form.keywordsText"
            type="textarea"
            :rows="3"
            placeholder="多个关键词用逗号或换行分隔"
          />
          <el-button size="default" type="primary" plain @click="openKeywordExtension">
            智能扩展
          </el-button>
        </div>
        <div class="form-tip">支持精确匹配、模糊匹配、通配符，三要素认证或订阅词条</div>
      </el-form-item>
      <el-form-item label="监测平台" prop="platforms">
        <el-checkbox-group v-model="form.platforms">
          <el-checkbox v-for="p in allPlatforms" :key="p.value" :label="p.value">
            {{ p.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="监测频率" prop="frequency">
        <el-radio-group v-model="form.frequency">
          <el-radio-button label="5min">5 分钟</el-radio-button>
          <el-radio-button label="15min">15 分钟</el-radio-button>
          <el-radio-button label="30min">30 分钟</el-radio-button>
          <el-radio-button label="60min">60 分钟</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="kwDialogVisible" title="AI 关键词扩展" width="640" :close-on-click-modal="false">
    <div class="kw-extension">
      <div class="kw-section">
        <label class="kw-label">种子关键词</label>
        <el-input
          v-model="kwForm.keywordsText"
          type="textarea"
          :rows="2"
          placeholder="输入种子关键词，多个词用逗号或换行分隔"
        />
      </div>
      <div class="kw-section">
        <label class="kw-label">推荐数量: {{ kwForm.count }}</label>
        <el-slider v-model="kwForm.count" :min="5" :max="20" :step="1" show-stops />
      </div>
      <div class="kw-section">
        <el-button type="primary" :loading="kwLoading" :disabled="!kwHasKeywords" @click="doKwSuggest">
          智能扩展
        </el-button>
      </div>
      <el-alert v-if="kwError === 'LLM_NOT_CONFIGURED'" title="LLM 未配置" type="warning" show-icon :description="'请先联系管理员配置 LLM 模型'" closable />
      <el-alert v-else-if="kwError" :title="'扩展失败'" type="error" show-icon :description="kwError" closable />
      <div v-if="kwResults.length > 0" class="kw-section">
        <label class="kw-label">推荐关键词 ({{ kwResults.length }})</label>
        <div class="kw-grid">
          <div
            v-for="item in kwResults"
            :key="item.word"
            class="kw-card"
            :class="{ 'kw-card--selected': kwSelected.includes(item.word) }"
            @click="kwToggle(item.word)"
          >
            <div class="kw-card__head">
              <span class="kw-card__word">{{ item.word }}</span>
              <el-tag :type="kwBadgeType(item.type)" size="small" effect="dark">
                {{ kwTypeLabel(item.type) }}
              </el-tag>
            </div>
            <div class="kw-card__score">
              <el-progress :percentage="item.score" :stroke-width="6" :color="kwScoreColor(item.score)" />
            </div>
            <div class="kw-card__reason" :title="item.reason">{{ item.reason }}</div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="kwDialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="kwSelected.length === 0" @click="kwApply">
        添加已选 ({{ kwSelected.length }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import EmptyStateGuide from '@/components/EmptyStateGuide.vue';

interface TaskRow {
  id: number;
  name: string;
  keywords: string;
  platforms: string[];
  frequency: string;
  status: string;
  lastRunAt: string;
  eventCount?: number;
  _running?: boolean;
}

const router = useRouter();
const tasks = ref<TaskRow[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const creating = ref(false);
const formRef = ref<FormInstance>();
const filterStatus = ref('all');

const allPlatforms = [
  { value: 'weixin', label: '微信公众号' },
  { value: 'weixin_video', label: '微信视频号' },
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'kuaishou', label: '快手' },
  { value: 'weibo', label: '微博' },
  { value: 'baijiahao', label: '百家号' },
];

const form = reactive({
  name: '',
  keywordsText: '',
  platforms: [] as string[],
  frequency: '15min',
});

const taskTypes = [
  { id: 'full', name: '全网舆情监测', desc: '覆盖微博、微信、抖音等全平台', icon: '🌐', platforms: ['weibo','weixin','douyin','xiaohongshu','kuaishou','baijiahao'] },
  { id: 'short-video', name: '短视频监测', desc: '专注抖音、快手、小红书平台', icon: '🎬', platforms: ['douyin','kuaishou','xiaohongshu'] },
  { id: 'social', name: '社交媒体监测', desc: '专注微博、微信公众号', icon: '💬', platforms: ['weibo','weixin'] },
  { id: 'competitor', name: '竞品监测', desc: '全平台监测竞品动态', icon: '🏢', platforms: ['weibo','weixin','douyin','xiaohongshu','kuaishou','baijiahao'] },
];

const selectedTaskType = ref('');

function selectTaskType(id: string) {
  selectedTaskType.value = id;
  const t = taskTypes.find(t => t.id === id);
  if (t) form.platforms = [...t.platforms];
}

const rules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  keywords: [{ required: true, message: '请输入至少一个关键词', trigger: 'blur' }],
  platforms: [{ required: true, message: '请选择至少一个平台', trigger: 'change' }],
  frequency: [{ required: true, message: '请选择监测频率', trigger: 'change' }],
};

function platformLabel(v: string): string {
  return allPlatforms.find((p) => p.value === v)?.label || v;
}

function parseKeywords(row: TaskRow): string[] {
  try {
    return JSON.parse(row.keywords || '[]') as string[];
  } catch {
    return [];
  }
}

function freqLabel(f: string): string {
  return ({ '5min': '5 min', '15min': '15 min', '30min': '30 min', '60min': '60 min' } as any)[f] || f;
}

function statusLabel(s: string): string {
  return ({ enabled: '运行中', paused: '已暂停', error: '异常' } as Record<string, string>)[s] || s;
}

function getStatusType(s: string): 'success' | 'warning' | 'danger' {
  return ({ enabled: 'success', paused: 'warning', error: 'danger' } as any)[s] || 'info';
}

function formatDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

const filteredTasks = computed(() => {
  if (filterStatus.value === 'all') return tasks.value;
  return tasks.value.filter((t) => t.status === filterStatus.value);
});

const statusFilters = computed(() => ({
  all: { value: 'all', label: '全部', count: tasks.value.length },
  enabled: { value: 'enabled', label: '运行中', count: tasks.value.filter((t) => t.status === 'enabled').length },
  paused: { value: 'paused', label: '已暂停', count: tasks.value.filter((t) => t.status === 'paused').length },
  error: { value: 'error', label: '异常', count: tasks.value.filter((t) => t.status === 'error').length },
}));

async function load(): Promise<void> {
  loading.value = true;
  try {
    tasks.value = await http.get('/monitor-tasks');
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  selectedTaskType.value = '';
  Object.assign(form, {
    name: '',
    keywordsText: '',
    platforms: ['weibo'],
    frequency: '15min',
  });
  dialogVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    const keywords = form.keywordsText
      .split(/[,\n;，；]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      ElMessage.warning('请输入至少一个关键词');
      return;
    }
    creating.value = true;
    try {
      await http.post('/monitor-tasks', {
        name: form.name,
        keywords,
        platforms: form.platforms,
        frequency: form.frequency,
      });
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      load();
    } catch (err: any) {
      ElMessage.error(err?.message || '创建失败');
    } finally {
      creating.value = false;
    }
  });
}

async function onToggle(row: TaskRow): Promise<void> {
  try {
    await http.put(`/monitor-tasks/${row.id}/toggle`);
    ElMessage.success('已切换状态');
    load();
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败');
  }
}

async function onRunNow(row: TaskRow): Promise<void> {
  if (row.status === 'paused') {
    ElMessage.warning('请先启用任务');
    return;
  }
  row._running = true;
  try {
    await http.post(`/monitor-tasks/${row.id}/run-now`);
    ElMessage.success('已加入采集队列，几秒后可查看新舆情');
    setTimeout(() => load(), 6000);
  } catch (err: any) {
    ElMessage.error(err?.message || '触发失败');
  } finally {
    row._running = false;
  }
}

async function onDelete(row: TaskRow): Promise<void> {
  await ElMessageBox.confirm(`确认删除任务 "${row.name}"?`);
  await http.delete(`/monitor-tasks/${row.id}`);
  ElMessage.success('已删除');
  load();
}

function goDetail(row: TaskRow): void {
  router.push(`/tasks/${row.id}`);
}

async function exportTasks(): Promise<void> {
  try {
    const blob = await http.post('/export/tasks', { format: 'csv' }, { responseType: 'blob' }) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (err: any) {
    ElMessage.error(err?.message || '导出失败');
  }
}

onMounted(load);

// Keyword extension
interface KwItem {
  word: string;
  type: 'synonym' | 'broader' | 'narrower' | 'related';
  score: number;
  reason: string;
}

const kwDialogVisible = ref(false);
const kwForm = reactive({ keywordsText: '', count: 10 });
const kwLoading = ref(false);
const kwResults = ref<KwItem[]>([]);
const kwError = ref('');
const kwSelected = ref<string[]>([]);

const kwHasKeywords = computed(() => kwForm.keywordsText.split(/[,\n;，；]/).map(s => s.trim()).filter(Boolean).length > 0);

function kwBadgeType(t: string): 'success' | 'warning' | 'info' | 'primary' {
  return ({ synonym: 'success', broader: 'warning', narrower: 'info', related: 'primary' } as any)[t] || 'info';
}

function kwTypeLabel(t: string): string {
  return ({ synonym: '同义词', broader: '上位词', narrower: '下位词', related: '相关词' } as any)[t] || t;
}

function kwScoreColor(s: number): string {
  if (s >= 80) return '#67C23A';
  if (s >= 50) return '#E6A23C';
  return '#909399';
}

function openKeywordExtension(): void {
  kwForm.keywordsText = form.keywordsText;
  kwForm.count = 10;
  kwResults.value = [];
  kwError.value = '';
  kwSelected.value = [];
  kwDialogVisible.value = true;
}

async function doKwSuggest(): Promise<void> {
  const keywords = kwForm.keywordsText.split(/[,\n;，；]/).map(s => s.trim()).filter(Boolean);
  if (keywords.length === 0) {
    ElMessage.warning('请输入至少一个种子关键词');
    return;
  }
  kwLoading.value = true;
  kwError.value = '';
  kwResults.value = [];
  try {
    const res = await http.post('/keywords/suggest', { keywords, count: kwForm.count });
    kwResults.value = res.keywords || [];
    if (res.error) kwError.value = res.error;
  } catch (err: any) {
    kwError.value = err?.message || '请求失败';
  } finally {
    kwLoading.value = false;
  }
}

function kwToggle(word: string): void {
  const idx = kwSelected.value.indexOf(word);
  if (idx >= 0) kwSelected.value.splice(idx, 1);
  else kwSelected.value.push(word);
}

function kwApply(): void {
  const existing = form.keywordsText.split(/[,\n;，；]/).map(s => s.trim()).filter(Boolean);
  const merged = [...new Set([...existing, ...kwSelected.value])];
  form.keywordsText = merged.join(', ');
  kwDialogVisible.value = false;
  ElMessage.success(`已添加 ${kwSelected.value.length} 个关键词`);
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
.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 8px;
}

.filter-tag {
  cursor: pointer;
  font-size: 12px;
  padding: 6px 12px;
}

.task-name {
  font-weight: 600;
  color: var(--text-primary);
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.keyword-chip {
  background: rgba(94, 114, 228, 0.18);
  color: #A78BFA;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.platforms-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.freq-tag {
  background: rgba(6, 182, 212, 0.15);
  color: #06B6D4;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.keywords-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.keywords-input-row .el-input {
  flex: 1;
}

.kw-extension {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kw-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kw-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.kw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.kw-card {
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kw-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.kw-card--selected {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.08);
}

.kw-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.kw-card__word {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.kw-card__reason {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
}

.task-type-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.task-type-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.task-type-card--active {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.1);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.task-type-card__icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.task-type-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.task-type-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.task-type-card__desc {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
