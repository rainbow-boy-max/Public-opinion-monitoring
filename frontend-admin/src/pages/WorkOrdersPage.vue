<template>
  <div class="work-orders-page">
    <GlassCard title="工单管理系统" subtitle="人工分析与处置工作流">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建工单</el-button>
      </template>

      <div class="stats-row">
        <StatCard label="待处理" :value="stats.pending" icon="🕐" icon-bg="linear-gradient(135deg, #F59E0B, #D97706)" :glow="'rgba(245, 158, 11, 0.4)'" />
        <StatCard label="分析中" :value="stats.inProgress" icon="🔍" icon-bg="linear-gradient(135deg, #3B82F6, #2563EB)" :glow="'rgba(59, 130, 246, 0.4)'" />
        <StatCard label="已解决" :value="stats.resolved" icon="✅" icon-bg="linear-gradient(135deg, #10B981, #059669)" :glow="'rgba(16, 185, 129, 0.4)'" />
        <StatCard label="已关闭" :value="stats.closed" icon="⭕" icon-bg="linear-gradient(135deg, #6B7280, #4B5563)" :glow="'rgba(107, 114, 128, 0.4)'" />
      </div>

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
        <el-select v-model="filters.type" placeholder="类型" clearable style="width:130px" @change="loadList">
          <el-option label="事件" value="event" />
          <el-option label="预警" value="alert" />
          <el-option label="手动" value="manual" />
        </el-select>
        <el-input v-model="filters.search" placeholder="搜索标题/描述" clearable style="width:240px" @clear="loadList" @keyup.enter="loadList" />
        <el-button @click="loadList">查询</el-button>
      </div>

      <div v-if="!loading && list.length === 0" class="empty-guide">
        <el-empty description="暂无工单，点击「新建工单」创建第一个工单进行人工研判。">
          <template #image>
            <div class="empty-guide-image">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><path d="M9 14l2 2 4-4"></path></svg>
            </div>
          </template>
          <el-button type="primary" :icon="Plus" @click="openCreate">新建工单</el-button>
        </el-empty>
      </div>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" @row-click="onRowClick">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="priorityTagType(row.priority)" size="small" effect="dark">
              {{ priorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            {{ typeLabel(row.type) }}
          </template>
        </el-table-column>
        <el-table-column label="指派人" width="120">
          <template #default="{ row }">
            <span v-if="row.assignedTo">用户 #{{ row.assignedTo }}</span>
            <span v-else class="text-muted">未指派</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="截止时间" width="170">
          <template #default="{ row }">{{ row.dueAt ? formatDate(row.dueAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click.stop="onRowClick(row)">详情</el-button>
          </template>
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

    <el-dialog v-model="detailVisible" title="工单详情" width="800" :close-on-click-modal="false">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="工单ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ typeLabel(detail.type) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="priorityTagType(detail.priority)" size="small" effect="dark">{{ priorityLabel(detail.priority) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2"><pre class="desc-text">{{ detail.description }}</pre></el-descriptions-item>
          <el-descriptions-item label="指派人">{{ detail.assignedTo ? '用户 #' + detail.assignedTo : '未指派' }}</el-descriptions-item>
          <el-descriptions-item label="截止时间">{{ detail.dueAt ? formatDate(detail.dueAt) : '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.analysis" label="分析" :span="2"><pre class="desc-text">{{ detail.analysis }}</pre></el-descriptions-item>
          <el-descriptions-item v-if="detail.resolution" label="处置方式">{{ detail.resolutionType || '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.resolution" label="处置内容" :span="2"><pre class="desc-text">{{ detail.resolution }}</pre></el-descriptions-item>
          <el-descriptions-item v-if="detail.attachments" label="附件" :span="2">
            <div class="attachment-list">
              <div v-for="(att, i) in parsedAttachments" :key="i" class="attachment-item">
                <a :href="att.url" target="_blank" class="attachment-link">{{ att.name }}</a>
                <span class="attachment-size">({{ formatSize(att.size) }})</span>
              </div>
            </div>
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.resolvedAt" label="解决时间">{{ formatDate(detail.resolvedAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.rating" label="用户评分" :span="2">
            <el-rate :model-value="detail.rating" disabled size="small" show-score />
            <span v-if="detail.feedback" style="margin-left:8px;color:var(--text-tertiary)">{{ detail.feedback }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div class="section-title">分析处置</div>
        <div class="action-row">
          <el-select v-model="statusAction" placeholder="变更状态" style="width:150px">
            <el-option label="受理" value="in_progress" />
            <el-option label="分析完成" value="resolved" />
            <el-option label="关闭" value="closed" />
          </el-select>
          <el-button type="primary" @click="onChangeStatus" :loading="statusLoading">执行</el-button>
          <el-button v-if="detail.status === 'pending' || !detail.assignedTo" @click="showAssign = true">指派</el-button>
          <el-button type="success" v-if="detail.status === 'in_progress'" @click="onResolveDirect" :loading="resolveLoading">完结工单</el-button>
          <el-button type="warning" v-if="detail.status === 'closed'" @click="onSendRatingInvite" :loading="ratingInviteLoading">发送评分邀请</el-button>
        </div>
        <div v-if="statusAction === 'resolved'" class="resolution-fields">
          <el-select v-model="resolutionType" placeholder="处置类型" style="width:150px">
            <el-option label="忽略" value="ignore" />
            <el-option label="回应" value="respond" />
            <el-option label="升级" value="escalate" />
            <el-option label="法律" value="legal" />
          </el-select>
          <el-input v-model="analysisText" type="textarea" :rows="3" placeholder="分析内容" />
          <el-input v-model="resolutionText" type="textarea" :rows="3" placeholder="处置内容" />
        </div>
        <div v-else>
          <el-input v-model="analysisText" type="textarea" :rows="3" placeholder="分析内容（可选）" style="margin-top:8px" />
        </div>

        <el-divider />

        <div class="section-title">评论 ({{ detail.comments?.length || 0 }})</div>
        <div class="action-row" style="margin-bottom:12px">
          <el-button type="primary" size="small" @click="showAdminReply = !showAdminReply">
            {{ showAdminReply ? '取消' : '回复工单' }}
          </el-button>
        </div>
        <div v-if="showAdminReply" class="comment-input-row" style="margin-bottom:12px">
          <el-input v-model="adminReplyText" type="textarea" :rows="2" placeholder="输入回复内容..." style="flex:1" />
          <el-button type="primary" @click="onAdminReply" :loading="adminReplyLoading">发送回复</el-button>
        </div>
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

    <el-dialog v-model="createVisible" title="新建工单" width="600">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" placeholder="工单标题" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="详细描述" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="createForm.type" style="width:100%">
            <el-option label="事件" value="event" />
            <el-option label="预警" value="alert" />
            <el-option label="手动" value="manual" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-select v-model="createForm.priority" style="width:100%">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
            <el-option label="紧急" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="分配处理人">
          <el-select v-model="createForm.assignedTo" placeholder="选择处理人" clearable style="width:100%">
            <el-option v-for="u in adminUsers" :key="u.id" :label="u.username || '用户 #' + u.id" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="createForm.dueAt" type="datetime" placeholder="选择截止时间" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreate" :loading="createLoading">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAssign" title="指派工单" width="400">
      <el-form label-width="80px">
        <el-form-item label="指派人">
          <el-select v-model="assignUserId" placeholder="选择处理人" style="width:100%">
            <el-option v-for="u in adminUsers" :key="u.id" :label="u.username || '用户 #' + u.id" :value="u.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAssign = false">取消</el-button>
        <el-button type="primary" @click="onAssign" :loading="assignLoading">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import StatCard from '@shared/components/StatCard.vue';

interface WorkOrder {
  id: number;
  userId: number;
  assignedTo: number | null;
  type: string;
  eventId: number | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  analysis: string | null;
  resolution: string | null;
  resolutionType: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rating: number | null;
  feedback: string | null;
  attachments: string | null;
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

const stats = reactive({ pending: 0, inProgress: 0, resolved: 0, closed: 0 });

const filters = reactive({
  status: '',
  priority: '',
  type: '',
  search: '',
});

const detailVisible = ref(false);
const detail = ref<WorkOrder | null>(null);
const statusAction = ref('in_progress');
const statusLoading = ref(false);
const analysisText = ref('');
const resolutionText = ref('');
const resolutionType = ref('ignore');
const commentText = ref('');
const commentLoading = ref(false);
const showAssign = ref(false);
const assignUserId = ref(0);
const assignLoading = ref(false);

const adminUsers = ref<{ id: number; username: string }[]>([]);
const showAdminReply = ref(false);
const adminReplyText = ref('');
const adminReplyLoading = ref(false);
const resolveLoading = ref(false);
const ratingInviteLoading = ref(false);

const parsedAttachments = computed(() => {
  if (!detail.value?.attachments) return [];
  try {
    return JSON.parse(detail.value.attachments);
  } catch { return []; }
});

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function onSendRatingInvite(): Promise<void> {
  if (!detail.value) return;
  ratingInviteLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/comment`, {
      content: `系统通知：已发送评分邀请，请用户评价本次工单处理服务。`,
    });
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    ratingInviteLoading.value = false;
  }
}

const createVisible = ref(false);
const createLoading = ref(false);
const createFormRef = ref<any>(null);
const createForm = reactive({
  title: '',
  description: '',
  type: 'manual',
  priority: 'medium',
  assignedTo: 0,
  dueAt: null as string | null,
});
const createRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
};

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

async function loadStats(): Promise<void> {
  try {
    const res = await http.get('/work-orders/stats');
    stats.pending = res.data.pending;
    stats.inProgress = res.data.inProgress;
    stats.resolved = res.data.resolved;
    stats.closed = res.data.closed;
  } catch (err) {
    console.error(err);
  }
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.type) params.set('type', filters.type);
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
    analysisText.value = res.data.analysis || '';
    resolutionText.value = res.data.resolution || '';
    resolutionType.value = res.data.resolutionType || 'ignore';
    commentText.value = '';
    showAdminReply.value = false;
    adminReplyText.value = '';
    detailVisible.value = true;
  } catch (err) {
    console.error(err);
  }
}

async function onChangeStatus(): Promise<void> {
  if (!detail.value) return;
  statusLoading.value = true;
  try {
    const payload: any = { status: statusAction.value };
    if (statusAction.value === 'resolved') {
      payload.analysis = analysisText.value;
      payload.resolution = resolutionText.value;
      payload.resolutionType = resolutionType.value;
    } else {
      payload.analysis = analysisText.value || undefined;
    }
    const res = await http.post(`/work-orders/${detail.value.id}/status`, payload);
    detail.value = res.data;
    detail.value.comments = detail.value?.comments || [];
    await loadList();
    await loadStats();
  } catch (err) {
    console.error(err);
  } finally {
    statusLoading.value = false;
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

async function onAssign(): Promise<void> {
  if (!detail.value || !assignUserId.value) return;
  assignLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/assign`, { assigneeId: assignUserId.value });
    showAssign.value = false;
    assignUserId.value = 0;
    await loadList();
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    assignLoading.value = false;
  }
}

async function onResolveDirect(): Promise<void> {
  if (!detail.value) return;
  resolveLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/status`, {
      status: 'resolved',
      analysis: analysisText.value || undefined,
      resolution: resolutionText.value || undefined,
      resolutionType: resolutionType.value || undefined,
    });
    await loadList();
    await loadStats();
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    resolveLoading.value = false;
  }
}

async function onAdminReply(): Promise<void> {
  if (!detail.value || !adminReplyText.value.trim()) return;
  adminReplyLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/comment`, { content: adminReplyText.value });
    adminReplyText.value = '';
    showAdminReply.value = false;
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    adminReplyLoading.value = false;
  }
}

function openCreate(): void {
  createForm.title = '';
  createForm.description = '';
  createForm.type = 'manual';
  createForm.priority = 'medium';
  createForm.assignedTo = 0;
  createForm.dueAt = null;
  createVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return;
    createLoading.value = true;
    try {
      await http.post('/work-orders', {
        title: createForm.title,
        description: createForm.description,
        type: createForm.type,
        priority: createForm.priority,
        assignedTo: createForm.assignedTo || undefined,
        dueAt: createForm.dueAt || undefined,
      });
      createVisible.value = false;
      await loadList();
      await loadStats();
    } catch (err) {
      console.error(err);
    } finally {
      createLoading.value = false;
    }
  });
}

async function loadAdminUsers(): Promise<void> {
  try {
    const res = await http.get('/users?role=admin');
    adminUsers.value = Array.isArray(res) ? res : res.items || res.data || [];
  } catch (err) {
    console.error(err);
  }
}

onMounted(() => {
  loadStats();
  loadList();
  loadAdminUsers();
});
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

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

.action-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.resolution-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.empty-guide {
  margin: 40px 0;
}

.empty-guide-image {
  opacity: 0.3;
  margin-bottom: 8px;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.attachment-link {
  color: var(--color-primary);
  text-decoration: none;
}

.attachment-link:hover {
  text-decoration: underline;
}

.attachment-size {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
