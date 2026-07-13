<template>
  <GlassCard title="监控任务" icon="🎯" subtitle="关键词 + 平台 + 频率订阅">
    <template #extra>
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
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && filteredTasks.length === 0" description="暂无监控任务" />
  </GlassCard>

  <el-dialog v-model="dialogVisible" title="创建监控任务" width="640">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="给任务起一个名字" />
      </el-form-item>
      <el-form-item label="关键词" prop="keywords">
        <el-input
          v-model="form.keywordsText"
          type="textarea"
          :rows="3"
          placeholder="多个关键词用逗号或换行分隔"
        />
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
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';

interface TaskRow {
  id: number;
  name: string;
  keywords: string;
  platforms: string[];
  frequency: string;
  status: string;
  lastRunAt: string;
  eventCount?: number;
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

async function onDelete(row: TaskRow): Promise<void> {
  await ElMessageBox.confirm(`确认删除任务 "${row.name}"?`);
  await http.delete(`/monitor-tasks/${row.id}`);
  ElMessage.success('已删除');
  load();
}

function goDetail(row: TaskRow): void {
  router.push(`/tasks/${row.id}`);
}

onMounted(load);
</script>

<style scoped>
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
</style>
