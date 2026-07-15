<template>
  <div class="work-orders-page">
    <GlassCard title="我的工单" subtitle="查看和处理分配给您的工单">
      <template #extra>
        <el-button type="primary" @click="showCreateDialog = true">提交工单</el-button>
      </template>
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

    <el-dialog v-model="detailVisible" title="工单详情" width="720" :close-on-click-modal="false">
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
          <el-descriptions-item v-if="detail.attachments" label="附件" :span="2">
            <div class="attachment-list">
              <div v-for="(att, i) in parsedAttachments" :key="i" class="attachment-item">
                <a :href="att.url" target="_blank" class="attachment-link">{{ att.name }}</a>
                <span class="attachment-size">({{ formatSize(att.size) }})</span>
              </div>
            </div>
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.resolvedAt" label="解决时间">{{ formatDate(detail.resolvedAt) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.rating" label="评分">
            <el-rate :model-value="detail.rating" disabled size="small" />
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <div class="action-row" v-if="detail.status === 'pending' || detail.status === 'in_progress'">
          <el-button type="primary" @click="showReplyInput = !showReplyInput">
            {{ showReplyInput ? '取消回复' : '回复' }}
          </el-button>
        </div>
        <div class="action-row" v-if="detail.status === 'resolved'">
          <el-button type="success" @click="onConfirmClose" :loading="closeLoading">确认完结</el-button>
          <el-button type="warning" @click="showRatingDialog = true">评价</el-button>
        </div>

        <div v-if="showReplyInput" class="comment-input-row" style="margin-bottom:12px">
          <el-input v-model="commentText" type="textarea" :rows="2" placeholder="输入回复内容..." style="flex:1" />
          <el-button type="primary" @click="onAddComment" :loading="commentLoading">发送</el-button>
        </div>

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

    <el-dialog v-model="showCreateDialog" title="提交工单" width="550">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="createForm.title" placeholder="工单标题" />
        </el-form-item>
        <el-form-item label="描述" required>
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="详细描述问题" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="createForm.priority" style="width:100%">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
            <el-option label="严重" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            ref="uploadRef"
            :action="`${baseURL}/upload`"
            :headers="uploadHeaders"
            :on-success="onUploadSuccess"
            :on-remove="onUploadRemove"
            :file-list="uploadFileList"
            :limit="5"
            :accept="'.jpg,.png,.gif,.webp,.mp4,.pdf,.doc,.docx,.txt'"
            list-type="text"
          >
            <el-button size="small" type="primary">选择文件</el-button>
            <template #tip>
              <div class="upload-tip">支持 jpg/png/gif/mp4/pdf/doc/txt，最多 5 个文件</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="onCreate" :loading="createLoading">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRatingDialog" title="评价工单" width="450">
      <div style="text-align:center;padding:20px 0">
        <div style="margin-bottom:16px;font-size:15px">请为本次工单处理评分</div>
        <el-rate v-model="ratingValue" :max="5" show-score style="justify-content:center" />
        <el-input v-model="ratingFeedback" type="textarea" :rows="3" placeholder="评价反馈（可选）" style="margin-top:16px" />
      </div>
      <template #footer>
        <el-button @click="showRatingDialog = false">取消</el-button>
        <el-button type="primary" @click="onSubmitRating" :loading="ratingLoading">提交评价</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
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

const filters = reactive({
  status: '',
  priority: '',
  search: '',
});

const detailVisible = ref(false);
const detail = ref<WorkOrder | null>(null);
const commentText = ref('');
const commentLoading = ref(false);
const showReplyInput = ref(false);
const closeLoading = ref(false);

const showCreateDialog = ref(false);
const createLoading = ref(false);
const createForm = reactive({
  title: '',
  description: '',
  priority: 'medium',
});

const uploadRef = ref<any>(null);
const uploadFileList = ref<any[]>([]);
const uploadedAttachments = ref<{ url: string; name: string; size: number }[]>([]);
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
const uploadHeaders = ref({ Authorization: `Bearer ${localStorage.getItem('user_token') || ''}` });

function onUploadSuccess(response: any, file: any, fileList: any[]) {
  if (response && response.url) {
    uploadedAttachments.value.push({ url: response.url, name: response.name, size: response.size });
  }
}

function onUploadRemove(file: any) {
  const idx = uploadedAttachments.value.findIndex(a => a.name === file.name);
  if (idx !== -1) uploadedAttachments.value.splice(idx, 1);
}

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

const showRatingDialog = ref(false);
const ratingValue = ref(0);
const ratingFeedback = ref('');
const ratingLoading = ref(false);

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
    showReplyInput.value = false;
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
    showReplyInput.value = false;
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    commentLoading.value = false;
  }
}

async function onCreate(): Promise<void> {
  if (!createForm.title.trim() || !createForm.description.trim()) return;
  createLoading.value = true;
  try {
    await http.post('/work-orders', {
      title: createForm.title,
      description: createForm.description,
      priority: createForm.priority,
      attachments: uploadedAttachments.value.length > 0 ? JSON.stringify(uploadedAttachments.value) : undefined,
    });
    showCreateDialog.value = false;
    createForm.title = '';
    createForm.description = '';
    createForm.priority = 'medium';
    uploadFileList.value = [];
    uploadedAttachments.value = [];
    await loadList();
  } catch (err) {
    console.error(err);
  } finally {
    createLoading.value = false;
  }
}

async function onConfirmClose(): Promise<void> {
  if (!detail.value) return;
  closeLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/status`, { status: 'closed' });
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
    await loadList();
  } catch (err) {
    console.error(err);
  } finally {
    closeLoading.value = false;
  }
}

async function onSubmitRating(): Promise<void> {
  if (!detail.value || !ratingValue.value) return;
  ratingLoading.value = true;
  try {
    await http.post(`/work-orders/${detail.value.id}/rate`, {
      rating: ratingValue.value,
      feedback: ratingFeedback.value || undefined,
    });
    showRatingDialog.value = false;
    ratingValue.value = 0;
    ratingFeedback.value = '';
    const res = await http.get(`/work-orders/${detail.value.id}`);
    detail.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    ratingLoading.value = false;
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

.action-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.text-muted {
  color: var(--text-tertiary);
  font-size: 13px;
}

.upload-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
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
