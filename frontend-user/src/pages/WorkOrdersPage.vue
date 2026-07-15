<template>
  <div class="work-orders-page">
    <GlassCard title="我的工单" subtitle="查看和处理分配给您的工单">
      <div class="filters-row">
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px" @change="loadList">
          <el-option label="待处理" value="pending" />
          <el-option label="分析中" value="in_progress" />
          <el-option label="已解决" value="resolved" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-select v-model="filters.priority" placeholder="优先级" clearable style="width:130px" @change="loadList">
          <el-option label="低" value="low" />
          <el-option label="中" value="medium" />
          <el-option label="高" value="high" />
          <el-option label="紧急" value="critical" />
        </el-select>
        <el-input v-model="filters.search" placeholder="搜索标题" clearable style="width:200px" @clear="loadList" @keyup.enter="loadList" />
        <el-button @click="loadList">查询</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" @row-click="onRowClick">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="priorityTagType(row.priority)" size="small" effect="dark">
              {{ priorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="onPageChange"
        />
      </div>
    </GlassCard>

    <el-dialog v-model="detailVisible" title="工单详情" width="700" :close-on-click-modal="false">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="工单ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="priorityTagType(detail.priority)" size="small" effect="dark">{{ priorityLabel(detail.priority) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="类型">{{ typeLabel(detail.type) }}</el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2"><pre class="desc-text">{{ detail.description }}</pre></el-descriptions-item>
          <el-descriptions-item v-if="detail.analysis" label="分析" :span="2"><pre class="desc-text">{{ detail.analysis }}</pre></el-descriptions-item>
          <el-descriptions-item v-if="detail.resolution" label="处置" :span="2"><pre class="desc-text">{{ detail.resolution }}</pre></el-descriptions-item>
          <el-descriptions-item v-if="detail.resolvedAt" label="解决时间">{{ formatDate(detail.resolvedAt) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div class="section-title">评论 ({{ detail.comments?.length || 0 }})</div>
        <div class="comments-thread">
          <div v-for="c in detail.comments" :key="c.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-user">用户 #{{ c.userId }}</span>
              <span class="comment-time">{{ formatDate(c.createdAt) }}</span>
            </div>
            <div class="comment-body">{{ c.content }}</div>
          </div>
          <div v-if="!detail.comments?.length" class="text-muted">暂无评论</div>
        </div>
        <div class="comment-input-row">
          <el-input v-model="commentText" placeholder="输入评论..." style="flex:1" />
          <el-button type="primary" @click="onAddComment" :loading="commentLoading">发送</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface WorkOrder {
  id: number;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  analysis: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  comments?: WorkOrderComment[];
}

interface WorkOrderComment {
  id: number;
  orderId: number;
  userId: number;
  content: string;
  createdAt: string;
}

const loading = ref(false);
const list = ref<WorkOrder[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const filters = reactive({
  status: '',
  priority: '',
  search: '',
});

const detailVisible = ref(false);
const detail = ref<WorkOrder | null>(null);
const commentText = ref('');
const commentLoading = ref(false);

function priorityLabel(p: string): string {
  return { low: '低', medium: '中', high: '高', critical: '紧急' }[p] || p;
}

function statusLabel(s: string): string {
  return { pending: '待处理', in_progress: '分析中', resolved: '已解决', closed: '已关闭' }[s] || s;
}

function typeLabel(t: string): string {
  return { event: '事件', alert: '预警', manual: '手动' }[t] || t;
}

function priorityTagType(p: string): 'info' | 'warning' | 'danger' | 'success' {
  return { low: 'info', medium: 'warning', high: 'danger', critical: 'danger' }[p] || 'info';
}

function statusTagType(s: string): 'info' | 'warning' | 'success' | 'primary' {
  return { pending: 'info', in_progress: 'warning', resolved: 'success', closed: 'primary' }[s] || 'info';
}

function formatDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.search) params.set('search', filters.search);
    params.set('page', String(page.value));
    params.set('pageSize', String(pageSize));
    const res = await http.get(`/work-orders?${params.toString()}`);
    list.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number): void {
  page.value = p;
  loadList();
}

async function onRowClick(row: WorkOrder): Promise<void> {
  try {
    const res = await http.get(`/work-orders/${row.id}`);
    detail.value = res.data;
    commentText.value = '';
    detailVisible.value = true;
  } catch (err) {
    console.error(err);
  }
}

async function onAddComment(): Promise<void> {
  if (!detail.value || !commentText.value.trim()) return;
  commentLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/comment`, { content: commentText.value });
    commentText.value = '';
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    commentLoading.value = false;
  }
}

onMounted(() => {
  loadList();
});
</script>

<style scoped>
.filters-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.desc-text {
  white-space: pre-wrap;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.comments-thread {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.comment-item {
  padding: 10px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.comment-user {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-primary);
}

.comment-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.comment-body {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}

.comment-input-row {
  display: flex;
  gap: 8px;
}

.text-muted {
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
