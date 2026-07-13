<template>
  <el-card>
    <template #header>
      <span>系统日志</span>
    </template>
    <div class="toolbar">
      <el-select v-model="moduleFilter" placeholder="模块" clearable style="width: 180px">
        <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
      </el-select>
      <el-select v-model="levelFilter" placeholder="级别" clearable style="width: 120px; margin-left: 10px">
        <el-option label="信息" value="info" />
        <el-option label="警告" value="warn" />
        <el-option label="错误" value="error" />
      </el-select>
      <el-button style="margin-left: 10px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="level" label="级别" width="80">
        <template #default="{ row }">
          <el-tag :type="row.level === 'error' ? 'danger' : row.level === 'warn' ? 'warning' : 'info'">
            {{ row.level }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="160" />
      <el-table-column prop="action" label="操作" width="200" />
      <el-table-column prop="detail" label="详情" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      :total="total"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px; justify-content: flex-end"
      @current-change="loadData"
      @size-change="loadData"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

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
const modules = ['auth', 'verify', 'sms', 'admin', 'collector'];

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
  margin-bottom: 16px;
}
</style>
