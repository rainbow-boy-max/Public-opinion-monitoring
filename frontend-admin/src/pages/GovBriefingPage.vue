<template>
  <GlassCard title="政务简报管理" subtitle="生成、查看、导出与上报舆情简报">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openGenerateDialog">生成简报</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-select v-model="filters.briefingType" placeholder="简报类型" clearable style="width: 140px" @change="loadData">
        <el-option label="日报" value="daily" />
        <el-option label="周报" value="weekly" />
        <el-option label="专题" value="special" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px" @change="loadData">
        <el-option label="草稿" value="draft" />
        <el-option label="已生成" value="generated" />
        <el-option label="已上报" value="submitted" />
      </el-select>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe @row-click="onRowClick">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.briefingType === 'daily' ? 'info' : row.briefingType === 'weekly' ? 'warning' : 'danger'">
            {{ typeLabel(row.briefingType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间范围" width="200">
        <template #default="{ row }">{{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="上报对象" width="140">
        <template #default="{ row }">
          <span v-if="row.submittedTo">{{ row.submittedTo }}</span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" width="170">
        <template #default="{ row }">{{ row.submittedAt ? formatDateTime(row.submittedAt) : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click.stop="onExport(row, 'word')">Word</el-button>
          <el-button text type="primary" size="small" @click.stop="onExport(row, 'pdf')">PDF</el-button>
          <el-button text type="success" size="small" @click.stop="openSubmitDialog(row)" :disabled="row.status === 'submitted'">上报</el-button>
          <el-button text type="danger" size="small" @click.stop="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" small @change="loadData" />
    </div>

    <el-dialog v-model="generateVisible" title="生成简报" width="560" @closed="resetGenerateForm">
      <el-form :model="genForm" label-width="100px">
        <el-form-item label="简报类型" required>
          <el-radio-group v-model="genForm.briefingType">
            <el-radio value="daily">日报</el-radio>
            <el-radio value="weekly">周报</el-radio>
            <el-radio value="special">专题</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="起始日期" required>
          <el-date-picker v-model="genForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" required>
          <el-date-picker v-model="genForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="genForm.title" placeholder="留空则自动生成" />
        </el-form-item>
        <el-form-item label="AI 生成">
          <el-switch v-model="genForm.useLlm" />
          <span class="form-hint">开启后使用 LLM 生成内容，否则使用模板</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="onGenerate">确认生成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="submitVisible" title="上报简报" width="480">
      <el-form :model="submitForm" label-width="100px">
        <el-form-item label="上报对象" required>
          <el-input v-model="submitForm.submittedTo" placeholder="如：区委办 / 上级宣传部" />
        </el-form-item>
        <el-form-item label="Webhook">
          <el-input v-model="submitForm.webhookUrl" placeholder="钉钉/飞书 Webhook 地址（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">确认上报</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="简报详情" width="800" top="5vh">
      <div v-if="detail" class="briefing-detail">
        <div class="briefing-detail__meta">
          <el-tag size="small">{{ typeLabel(detail.briefingType) }}</el-tag>
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
          <span>{{ formatDate(detail.startDate) }} ~ {{ formatDate(detail.endDate) }}</span>
        </div>
        <div v-if="detail.status === 'submitted'" class="briefing-detail__submit-info">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="上报对象">{{ detail.submittedTo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="上报时间">{{ detail.submittedAt ? formatDateTime(detail.submittedAt) : '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
        <div class="briefing-detail__content render-markdown" v-html="renderMarkdown(detail.content || '')" />
      </div>
    </el-dialog>
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminGovBriefingPage' });
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const generating = ref(false);
const submitting = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filters = reactive({ briefingType: '', status: '' });

const generateVisible = ref(false);
const genForm = reactive({
  briefingType: 'daily' as 'daily' | 'weekly' | 'special',
  startDate: '',
  endDate: '',
  title: '',
  useLlm: true,
});

const submitVisible = ref(false);
const submitForm = reactive({ id: 0, submittedTo: '', webhookUrl: '' });

const detailVisible = ref(false);
const detail = ref<any>(null);

function typeLabel(t: string): string {
  return t === 'daily' ? '日报' : t === 'weekly' ? '周报' : '专题';
}
function statusLabel(s: string): string {
  return s === 'draft' ? '草稿' : s === 'generated' ? '已生成' : '已上报';
}
function statusTagType(s: string): '' | 'success' | 'warning' | 'info' {
  return s === 'draft' ? 'info' : s === 'generated' ? 'warning' : 'success';
}
function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('zh-CN');
}
function formatDateTime(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}
import { sanitize } from '@/utils/sanitize';

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(.|\n)+?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  // P1-13: XSS 防护 - 使用 DOMPurify 消毒
  return sanitize(html);
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.briefingType) params.briefingType = filters.briefingType;
    if (filters.status) params.status = filters.status;
    const res = await http.get('/gov/briefing', { params });
    const payload = (res && (res.data || res.items)) || [];
    tableData.value = Array.isArray(payload) ? payload : [];
    total.value = res?.total || 0;
  } catch {
    ElMessage.error('加载简报列表失败');
  } finally {
    loading.value = false;
  }
}

function openGenerateDialog(): void {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  genForm.startDate = yesterday.toISOString().slice(0, 10);
  genForm.endDate = today.toISOString().slice(0, 10);
  genForm.title = '';
  genForm.useLlm = true;
  genForm.briefingType = 'daily';
  generateVisible.value = true;
}

function resetGenerateForm(): void {
  genForm.title = '';
}

async function onGenerate(): Promise<void> {
  if (!genForm.startDate || !genForm.endDate) {
    ElMessage.warning('请选择日期范围');
    return;
  }
  generating.value = true;
  try {
    await http.post('/gov/briefing/generate', {
      briefingType: genForm.briefingType,
      startDate: genForm.startDate,
      endDate: genForm.endDate,
      title: genForm.title || undefined,
      useLlm: genForm.useLlm,
    });
    ElMessage.success('简报生成成功');
    generateVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('简报生成失败');
  } finally {
    generating.value = false;
  }
}

async function onRowClick(row: any): Promise<void> {
  try {
    const res = await http.get(`/gov/briefing/${row.id}`);
    detail.value = res?.data ?? res;
    detailVisible.value = true;
  } catch {
    ElMessage.error('加载详情失败');
  }
}

async function onExport(row: any, format: 'word' | 'pdf'): Promise<void> {
  try {
    const res = await http.get(`/gov/briefing/${row.id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    const blob = new Blob([res]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${row.title}.${format === 'word' ? 'docx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (err: any) {
    const msg = err?.message || err?.messageZh || '导出失败';
    ElMessage.error(typeof msg === 'string' ? msg : '导出失败');
  }
}

function openSubmitDialog(row: any): void {
  submitForm.id = row.id;
  submitForm.submittedTo = '';
  submitForm.webhookUrl = '';
  submitVisible.value = true;
}

async function onSubmit(): Promise<void> {
  if (!submitForm.submittedTo) {
    ElMessage.warning('请填写上报对象');
    return;
  }
  submitting.value = true;
  try {
    await http.post(`/gov/briefing/${submitForm.id}/submit`, {
      submittedTo: submitForm.submittedTo,
      webhookUrl: submitForm.webhookUrl || undefined,
    });
    ElMessage.success('上报成功');
    submitVisible.value = false;
    await loadData();
  } catch {
    ElMessage.error('上报失败');
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: any): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除简报「${row.title}」？`, '确认', { type: 'warning' });
    await http.delete(`/gov/briefing/${row.id}`);
    ElMessage.success('已删除');
    await loadData();
  } catch { /* ignore */ }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.form-hint { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.briefing-detail { max-height: 70vh; overflow-y: auto; }
.briefing-detail__meta { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
.briefing-detail__submit-info { margin-bottom: 16px; }
.muted { color: var(--el-text-color-secondary); }
.render-markdown { line-height: 1.8; color: var(--text-primary); font-size: 14px; }
.render-markdown h2, .render-markdown h3, .render-markdown h4 { margin: 16px 0 8px; }
.render-markdown ul { padding-left: 20px; margin: 8px 0; }
.render-markdown li { margin: 4px 0; }
</style>
