<template>
  <div class="monitor-tasks-page">
    <GlassCard title="监控任务管理" icon="📋" subtitle="查看和管理所有监控任务">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="showCreate = true">新建任务</el-button>
      </template>

      <div class="filters-row">
        <el-select v-model="filters.status" placeholder="状态筛选" clearable style="width:130px" @change="loadTasks">
          <el-option label="启用" value="enabled" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="搜索任务名称" clearable style="width:200px" @clear="loadTasks">
          <template #prefix>🔍</template>
        </el-input>
        <el-button @click="loadTasks">查询</el-button>
      </div>

      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="任务名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="关键词" width="200">
          <template #default="{ row }">
            <el-tag v-for="kw in parseKeywords(row.keywords)" :key="kw" size="small" style="margin: 2px;">{{ kw }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="200">
          <template #default="{ row }">
            <el-tag v-for="p in row.platforms" :key="p" size="small" style="margin: 2px;">{{ platformLabel(p) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="频率" width="100">
          <template #default="{ row }">{{ frequencyLabel(row.frequency) }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewTask(row)">详情</el-button>
            <el-button type="warning" link size="small" @click="toggleStatus(row)">
              {{ row.status === 'enabled' ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadTasks"
          @size-change="loadTasks"
        />
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'MonitorTasksPage' });
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const showCreate = ref(false);
const tasks = ref<any[]>([]);

const filters = reactive({
  status: '',
  keyword: '',
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

onMounted(() => {
  loadTasks();
});

async function loadTasks() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('pageSize', String(pagination.pageSize));
    if (filters.status) params.set('status', filters.status);
    if (filters.keyword) params.set('keyword', filters.keyword);

    const res = await http.get(`/monitor-tasks?${params.toString()}`);
    tasks.value = res.data || [];
    pagination.total = res.total || tasks.value.length;
  } catch (err: any) {
    ElMessage.error(err?.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function parseKeywords(keywords: string | string[]): string[] {
  if (Array.isArray(keywords)) return keywords;
  try {
    return JSON.parse(keywords);
  } catch {
    return [];
  }
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    weibo: '微博',
    wechat: '微信',
    douyin: '抖音',
    xiaohongshu: '小红书',
    kuaishou: '快手',
    bilibili: 'B站',
    toutiao: '头条',
  };
  return map[platform] || platform;
}

function frequencyLabel(freq: string): string {
  const map: Record<string, string> = {
    '5min': '5分钟',
    '15min': '15分钟',
    '30min': '30分钟',
    '1hour': '1小时',
  };
  return map[freq] || freq;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', { hour12: false });
}

function viewTask(task: any) {
  ElMessage.info(`任务详情：${task.name}（ID: ${task.id}）`);
}

async function toggleStatus(task: any) {
  const newStatus = task.status === 'enabled' ? 'disabled' : 'enabled';
  try {
    await http.patch(`/monitor-tasks/${task.id}/toggle`);
    task.status = newStatus;
    ElMessage.success(newStatus === 'enabled' ? '已启用' : '已禁用');
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败');
  }
}
</script>

<style scoped>
.filters-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
