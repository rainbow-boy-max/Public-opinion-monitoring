<template>
  <GlassCard title="AI 公关报告管理" subtitle="查看所有用户的公关分析报告">
    <template #extra>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-input v-model="search" placeholder="搜索标题" clearable style="width: 220px" @clear="loadData" @keyup.enter="loadData" />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="loadData">
        <el-option label="已完成" value="completed" />
        <el-option label="生成中" value="generating" />
        <el-option label="待处理" value="pending" />
        <el-option label="失败" value="failed" />
      </el-select>
      <el-button type="primary" @click="loadData">查询</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe @row-click="onRowClick">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="用户" width="120">
        <template #default="{ row }"><code>{{ row.user?.username || '—' }}</code></template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'generating' ? 'warning' : row.status === 'failed' ? 'danger' : 'info'" size="small">
            {{ row.status === 'completed' ? '已完成' : row.status === 'generating' ? '生成中' : row.status === 'pending' ? '待处理' : '失败' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="modelUsed" label="模型" width="140" />
      <el-table-column prop="createdAt" label="时间" width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button text type="danger" size="small" @click.stop="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" small @change="loadData" />
    </div>

    <el-dialog v-model="detailVisible" title="报告详情" width="800" top="5vh">
      <div v-if="detail" class="report-detail">
        <div class="report-section">
          <div class="report-section__body render-markdown" v-html="renderMarkdown(detail.analysis || '')" />
        </div>
        <div v-if="detail.strategy" class="report-section">
          <div class="report-section__body render-markdown" v-html="renderMarkdown(detail.strategy || '')" />
        </div>
      </div>
    </el-dialog>
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPrReportsPage' });
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const search = ref('');
const statusFilter = ref('');
const detailVisible = ref(false);
const detail = ref<any>(null);

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(.|\n)+?<\/li>)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (search.value) params.search = search.value;
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await http.get('/pr/admin/all', { params });
    tableData.value = res.items || [];
    total.value = res.total || 0;
  } catch {
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

function onRowClick(row: any) {
  detail.value = row;
  detailVisible.value = true;
}

async function onDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除报告 #${row.id}？`, '确认', { type: 'warning' });
    await http.delete(`/pr/admin/${row.id}`);
    ElMessage.success('已删除');
    await loadData();
  } catch { /* ignore */ }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
.report-detail { max-height: 70vh; overflow-y: auto; padding: 0 4px; }
.render-markdown { line-height: 1.8; color: var(--text-primary); font-size: 14px; }
.render-markdown h2, .render-markdown h3, .render-markdown h4 { margin: 16px 0 8px; color: var(--text-primary); }
.render-markdown ul { padding-left: 20px; margin: 8px 0; }
.render-markdown li { margin: 4px 0; }
</style>
