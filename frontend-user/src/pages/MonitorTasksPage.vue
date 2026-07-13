<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>监控任务</span>
        <el-button type="primary" @click="openCreate">创建任务</el-button>
      </div>
    </template>
    <el-table :data="tasks" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="任务名称" />
      <el-table-column label="关键词">
        <template #default="{ row }">
          <el-tag v-for="kw in parseKeywords(row)" :key="kw" size="small" style="margin-right: 4px">
            {{ kw }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="平台" width="180">
        <template #default="{ row }">
          <el-tag
            v-for="p in row.platforms"
            :key="p"
            size="small"
            type="info"
            style="margin-right: 4px"
          >
            {{ platformLabel(p) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="frequency" label="频率" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastRunAt" label="最后运行" width="180">
        <template #default="{ row }">
          {{ row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="goDetail(row)">详情</el-button>
          <el-button size="small" :type="row.status === 'enabled' ? 'warning' : 'success'" @click="onToggle(row)">
            {{ row.status === 'enabled' ? '暂停' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" title="创建监控任务" width="600px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="关键词" prop="keywords">
        <el-input
          v-model="form.keywordsText"
          type="textarea"
          :rows="3"
          placeholder="多个关键词用逗号或换行分隔"
        />
      </el-form-item>
      <el-form-item label="监测平台" prop="platforms">
        <el-checkbox-group v-model="form.platforms">
          <el-checkbox
            v-for="p in allPlatforms"
            :key="p.value"
            :label="p.value"
          >
            {{ p.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="频率" prop="frequency">
        <el-select v-model="form.frequency">
          <el-option label="每 5 分钟" value="5min" />
          <el-option label="每 15 分钟" value="15min" />
          <el-option label="每 30 分钟" value="30min" />
          <el-option label="每 60 分钟" value="60min" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import http from '@/utils/http';

interface TaskRow {
  id: number;
  name: string;
  keywords: string;
  platforms: string[];
  frequency: string;
  status: string;
  lastRunAt: string;
}

const router = useRouter();
const tasks = ref<TaskRow[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const creating = ref(false);
const formRef = ref<FormInstance>();

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

const allPlatforms = [
  { value: 'weixin', label: '微信公众号' },
  { value: 'weixin_video', label: '微信视频号' },
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'kuaishou', label: '快手' },
  { value: 'weibo', label: '微博' },
  { value: 'baijiahao', label: '百家号' },
];

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

function statusLabel(s: string): string {
  return ({ enabled: '运行中', paused: '已暂停', error: '异常' } as Record<string, string>)[s] || s;
}

function statusTagType(s: string): 'success' | 'warning' | 'danger' {
  return ({ enabled: 'success', paused: 'warning', error: 'danger' } as any)[s] || 'info';
}

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
    platforms: [],
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
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
