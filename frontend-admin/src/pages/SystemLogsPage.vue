<template>
  <GlassCard title="操作审计日志" subtitle="管理员操作记录与追溯">
    <template #extra>
      <el-button :icon="Download" @click="exportCSV">导出 CSV</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-input
        v-model="search"
        placeholder="搜索标题/内容"
        clearable
        style="width: 220px"
        @clear="loadData"
        @keyup.enter="loadData"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="moduleFilter" placeholder="模块" clearable style="width: 160px" @change="onModuleChange">
        <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
      </el-select>
      <el-select v-model="actionFilter" placeholder="操作" clearable style="width: 160px">
        <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px"
        @change="loadData"
      />
      <el-button type="primary" @click="loadData">查询</el-button>
    </div>

    <el-table
      :data="tableData"
      v-loading="loading"
      stripe
      @expand-change="onExpandChange"
      row-key="id"
    >
      <el-table-column type="expand" width="40">
        <template #default="{ row }">
          <div class="expand-detail">
            <div class="detail-row" v-if="row.content">
              <span class="detail-label">内容：</span>
              <pre class="detail-value mono">{{ row.content }}</pre>
            </div>
            <div class="detail-row">
              <span class="detail-label">IP 地址：</span>
              <code class="detail-value">{{ row.ipAddress || '—' }}</code>
            </div>
            <div class="detail-row" v-if="row.actorId">
              <span class="detail-label">操作者 ID：</span>
              <code class="detail-value">#{{ row.actorId }}</code>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="72">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">#{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column label="模块" width="130">
        <template #default="{ row }">
          <el-tag :type="getModuleTagType(row.module)" size="small" effect="plain">
            {{ row.module }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-tag :type="getActionTagType(row.action)" size="small" effect="dark">
            {{ row.action }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="标题" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="title-text">{{ row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作者" width="100">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-secondary)">{{ row.actorType || 'system' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="资源" width="130">
        <template #default="{ row }">
          <span v-if="row.resourceType" class="mono" style="color: var(--text-tertiary)">
            {{ row.resourceType }}<span v-if="row.resourceId">/#{{ row.resourceId }}</span>
          </span>
          <span v-else style="color: var(--text-tertiary)">—</span>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">{{ formatDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 24px; justify-content: flex-end"
      @current-change="loadData"
      @size-change="loadData"
    />
  </GlassCard>
</template>

<script setup lang="ts">
defineOptions({ name: 'SystemLogsPage' });
import { ref, onMounted } from 'vue';
import { Refresh, Download, Search } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface AuditRow {
  id: number;
  actorId: number | null;
  actorType: string;
  module: string;
  action: string;
  resourceType: string | null;
  resourceId: number | null;
  title: string;
  content: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const tableData = ref<AuditRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const moduleFilter = ref('');
const actionFilter = ref('');
const search = ref('');
const dateRange = ref<[string, string] | null>(null);
const modules = ref<string[]>([]);
const actions = ref<string[]>([]);

const MODULE_TAG_MAP: Record<string, string> = {
  auth: 'info',
  agents: 'warning',
  'monitor-tasks': 'success',
  webhooks: '',
  users: 'danger',
  config: '',
  system: 'info',
};

const ACTION_TAG_MAP: Record<string, string> = {
  login: 'info',
  logout: 'info',
  create: 'success',
  update: 'warning',
  delete: 'danger',
  'test-success': 'success',
  'test-fail': 'danger',
};

function getModuleTagType(module: string): string {
  return MODULE_TAG_MAP[module] || '';
}

function getActionTagType(action: string): string {
  return ACTION_TAG_MAP[action] || '';
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function onModuleChange(): void {
  actionFilter.value = '';
  await fetchActions();
  await loadData();
}

async function fetchModules(): Promise<void> {
  try {
    modules.value = await http.get('/audit/modules');
  } catch {
    modules.value = [];
  }
}

async function fetchActions(): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    if (moduleFilter.value) params.module = moduleFilter.value;
    actions.value = await http.get('/audit/actions', { params });
  } catch {
    actions.value = [];
  }
}

function onExpandChange(): void {
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (moduleFilter.value) params.module = moduleFilter.value;
    if (actionFilter.value) params.action = actionFilter.value;
    if (search.value) params.search = search.value;
    if (dateRange.value) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const res: any = await http.get('/audit/logs', { params });
    tableData.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function exportCSV(): void {
  const headers = ['ID', '模块', '操作', '标题', '操作者类型', '操作者ID', '资源类型', '资源ID', 'IP地址', '内容', '时间'];
  const rows = tableData.value.map((r) => [
    r.id,
    r.module,
    r.action,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    r.actorType,
    r.actorId ?? '',
    r.resourceType || '',
    r.resourceId ?? '',
    r.ipAddress || '',
    `"${(r.content || '').replace(/"/g, '""')}"`,
    r.createdAt,
  ]);

  let csv = '\uFEFF';
  csv += headers.join(',') + '\n';
  csv += rows.map((row) => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  await fetchModules();
  await fetchActions();
  await loadData();
});
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.title-text {
  font-weight: 500;
  color: var(--text-primary);
}

.mono {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

.expand-detail {
  padding: 12px 20px;
}

.detail-row {
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
}

.detail-label {
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 80px;
}

.detail-value {
  color: var(--text-primary);
  margin: 0;
}

pre.detail-value {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  background: var(--bg-secondary);
  padding: 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  flex: 1;
}
</style>
