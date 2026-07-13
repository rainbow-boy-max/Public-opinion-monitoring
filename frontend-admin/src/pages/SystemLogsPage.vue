<template>
  <GlassCard title="系统日志" icon="📜" subtitle="API 请求与异常记录">
    <template #extra>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-select v-model="moduleFilter" placeholder="模块" clearable style="width: 180px">
        <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
      </el-select>
      <el-select v-model="levelFilter" placeholder="级别" clearable style="width: 140px">
        <el-option label="信息" value="info" />
        <el-option label="警告" value="warn" />
        <el-option label="错误" value="error" />
      </el-select>
      <el-button type="primary" @click="loadData">查询</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">#{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="level" label="级别" width="100">
        <template #default="{ row }">
          <el-tag :type="getLevelTagType(row.level)" size="small" effect="dark">
            {{ getLevelText(row.level) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="160">
        <template #default="{ row }">
          <code class="module-code">{{ row.module }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="action" label="操作">
        <template #default="{ row }">
          <span class="action-text">{{ row.action }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="detail" label="详情" show-overflow-tooltip min-width="200">
        <template #default="{ row }">
          <span class="detail-text mono">{{ row.detail || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="170">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">{{ formatDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 24px; justify-content: flex-end"
      @current-change="loadData"
      @size-change="loadData"
    />
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface LogRow {
  id: number;
  level: 'info' | 'warn' | 'error';
  module: string;
  action: string;
  detail: string;
  createdAt: string;
}

const tableData = ref<LogRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const moduleFilter = ref('');
const levelFilter = ref('');
const modules = ref(['auth', 'verify', 'sms', 'admin', 'collector']);

function getLevelText(level: string): string {
  return ({ info: '信息', warn: '警告', error: '错误' } as any)[level] || level;
}

function getLevelTagType(level: string): 'info' | 'warning' | 'danger' {
  return ({ info: 'info', warn: 'warning', error: 'danger' } as any)[level] || 'info';
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (moduleFilter.value) params.module = moduleFilter.value;
    if (levelFilter.value) params.level = levelFilter.value;
    const res = await http.get('/admin/system-logs', { params });
    tableData.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.module-code,
.action-text,
.detail-text {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
}

.action-text {
  color: var(--text-primary);
  font-weight: 500;
}

.detail-text {
  color: var(--text-secondary);
  word-break: break-all;
}
</style>
