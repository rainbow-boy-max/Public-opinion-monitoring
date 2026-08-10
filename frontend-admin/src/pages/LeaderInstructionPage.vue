<template>
  <GlassCard title="领导批示管理" subtitle="领导批示登记、流转与反馈跟踪">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增批示</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px" @change="loadData">
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已完成" value="completed" />
      </el-select>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="关联事件" width="110">
        <template #default="{ row }">
          <el-link v-if="row.eventId" type="primary" :underline="false" @click="openEventDrawer(row)"><code>#{{ row.eventId }}</code></el-link>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="leaderName" label="领导" width="120" />
      <el-table-column prop="instruction" label="批示内容" min-width="240" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="handlerName" label="处理人" width="120">
        <template #default="{ row }">{{ row.handlerName || '-' }}</template>
      </el-table-column>
      <el-table-column label="截止日期" width="120">
        <template #default="{ row }">{{ row.deadline ? formatDate(row.deadline) : '-' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openEditDialog(row)">处理</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" small @change="loadData" />
    </div>

    <el-dialog v-model="createVisible" title="新增领导批示" width="560">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="事件 ID" required>
          <el-input-number v-model="createForm.eventId" :min="1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="领导姓名" required>
          <el-input v-model="createForm.leaderName" placeholder="如：张书记" />
        </el-form-item>
        <el-form-item label="批示内容" required>
          <el-input v-model="createForm.instruction" type="textarea" :rows="4" placeholder="请输入批示内容" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="createForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="处理批示" width="560">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio value="pending">待处理</el-radio>
            <el-radio value="processing">处理中</el-radio>
            <el-radio value="completed">已完成</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="editForm.handlerName" placeholder="处理人姓名" />
        </el-form-item>
        <el-form-item label="处理反馈">
          <el-input v-model="editForm.feedback" type="textarea" :rows="4" placeholder="处理情况反馈" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="editForm.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="onEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="eventDrawerVisible" title="关联舆情事件" size="480px" direction="rtl">
      <div v-loading="eventLoading">
        <el-empty v-if="!eventLoading && !eventDetail" description="未找到关联事件" />
        <div v-else-if="eventDetail" class="event-detail">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="事件 ID">#{{ eventDetail.id }}</el-descriptions-item>
            <el-descriptions-item label="平台">{{ eventDetail.platform || '-' }}</el-descriptions-item>
            <el-descriptions-item label="作者">{{ eventDetail.author || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发布时间">{{ eventDetail.publishTime ? formatDateTime(eventDetail.publishTime) : '-' }}</el-descriptions-item>
            <el-descriptions-item label="情感倾向">
              <el-tag size="small" :type="sentimentTagType(eventDetail.sentiment)">{{ sentimentLabel(eventDetail.sentiment) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="匹配关键词">
              <el-tag v-for="kw in (eventDetail.matchedKeywords || [])" :key="kw" size="small" class="kw-tag">{{ kw }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <div class="event-detail__title">{{ eventDetail.title }}</div>
          <div class="event-detail__summary">{{ eventDetail.summary || eventDetail.content }}</div>
          <el-link v-if="eventDetail.url" :href="eventDetail.url" target="_blank" type="primary">查看原文</el-link>
        </div>
      </div>
    </el-drawer>
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminLeaderInstructionPage' });
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const creating = ref(false);
const editing = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filters = reactive({ status: '' });

const createVisible = ref(false);
const createForm = reactive({ eventId: 0, leaderName: '', instruction: '', deadline: '' });

const editVisible = ref(false);
const editForm = reactive({ id: 0, status: 'pending' as 'pending' | 'processing' | 'completed', handlerName: '', feedback: '', deadline: '' });

const eventDrawerVisible = ref(false);
const eventLoading = ref(false);
const eventDetail = ref<any>(null);

function sentimentLabel(s: string): string {
  return s === 'positive' ? '正面' : s === 'negative' ? '负面' : '中性';
}
function sentimentTagType(s: string): '' | 'success' | 'warning' | 'info' {
  return s === 'positive' ? 'success' : s === 'negative' ? 'danger' as any : 'info';
}
function openEventDrawer(row: any): void {
  eventDrawerVisible.value = true;
  eventDetail.value = null;
  if (row.event) {
    eventDetail.value = row.event;
    return;
  }
  eventLoading.value = true;
  http.get(`/gov/instruction/${row.id}`)
    .then((res: any) => {
      eventDetail.value = res?.data?.event ?? res?.event ?? null;
      if (!eventDetail.value && row.eventId) {
        eventDetail.value = { id: row.eventId, platform: '-', author: '-' };
      }
    })
    .catch(() => {
      eventDetail.value = { id: row.eventId, platform: '-', author: '-' };
    })
    .finally(() => {
      eventLoading.value = false;
    });
}

function statusLabel(s: string): string {
  return s === 'pending' ? '待处理' : s === 'processing' ? '处理中' : '已完成';
}
function statusTagType(s: string): '' | 'success' | 'warning' | 'info' {
  return s === 'pending' ? 'info' : s === 'processing' ? 'warning' : 'success';
}
function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('zh-CN');
}
function formatDateTime(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    const res = await http.get('/gov/instruction', { params });
    const payload = (res && (res.data || res.items)) || [];
    tableData.value = Array.isArray(payload) ? payload : [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error('加载批示列表失败');
  } finally {
    loading.value = false;
  }
}

function openCreateDialog(): void {
  createForm.eventId = 0;
  createForm.leaderName = '';
  createForm.instruction = '';
  createForm.deadline = '';
  createVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!createForm.eventId || !createForm.leaderName || !createForm.instruction) {
    ElMessage.warning('请填写必填项');
    return;
  }
  creating.value = true;
  try {
    await http.post('/gov/instruction', {
      eventId: createForm.eventId,
      leaderName: createForm.leaderName,
      instruction: createForm.instruction,
      deadline: createForm.deadline || undefined,
    });
    ElMessage.success('批示创建成功');
    createVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('创建失败');
  } finally {
    creating.value = false;
  }
}

function openEditDialog(row: any): void {
  editForm.id = row.id;
  editForm.status = row.status;
  editForm.handlerName = row.handlerName || '';
  editForm.feedback = row.feedback || '';
  editForm.deadline = row.deadline ? row.deadline.slice(0, 10) : '';
  editVisible.value = true;
}

async function onEdit(): Promise<void> {
  editing.value = true;
  try {
    await http.put(`/gov/instruction/${editForm.id}`, {
      status: editForm.status,
      handlerName: editForm.handlerName || undefined,
      feedback: editForm.feedback || undefined,
      deadline: editForm.deadline || undefined,
    });
    ElMessage.success('更新成功');
    editVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('更新失败');
  } finally {
    editing.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.event-detail { padding: 0 4px; }
.event-detail__title { font-weight: 600; margin: 12px 0 8px; font-size: 15px; color: var(--el-text-color-primary); }
.event-detail__summary { color: var(--el-text-color-regular); line-height: 1.7; font-size: 13px; margin-bottom: 12px; }
.kw-tag { margin-right: 4px; margin-bottom: 4px; }
</style>
