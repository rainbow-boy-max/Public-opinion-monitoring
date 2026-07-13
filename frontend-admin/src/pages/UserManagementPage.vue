<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>用户管理</span>
      </div>
    </template>
    <div class="toolbar">
      <el-input
        v-model="searchText"
        placeholder="搜索用户名或手机号"
        clearable
        style="width: 240px"
        @keyup.enter="loadData"
      />
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px; margin-left: 10px">
        <el-option label="未认证" value="unverified" />
        <el-option label="已认证" value="verified" />
        <el-option label="已封禁" value="banned" />
      </el-select>
      <el-button type="primary" style="margin-left: 10px" @click="loadData">查询</el-button>
    </div>
    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="phone" label="手机号" />
      <el-table-column prop="realName" label="真实姓名" />
      <el-table-column prop="authStatus" label="认证状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.authStatus)">
            {{ statusText(row.authStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录时间" width="180">
        <template #default="{ row }">
          {{ row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.authStatus !== 'banned'"
            type="danger"
            size="small"
            @click="onBan(row)"
          >
            封禁
          </el-button>
          <el-button
            v-else
            type="success"
            size="small"
            @click="onUnban(row)"
          >
            解封
          </el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '@/utils/http';

interface UserRow {
  id: number;
  username: string;
  phone: string;
  realName: string | null;
  authStatus: 'unverified' | 'verified' | 'banned';
  lastLoginAt: string | null;
  createdAt: string;
}

const tableData = ref<UserRow[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchText = ref('');
const statusFilter = ref('');

function statusText(s: string): string {
  return { unverified: '未认证', verified: '已认证', banned: '已封禁' }[s] || s;
}

function getStatusTagType(s: string): 'success' | 'info' | 'danger' {
  return ({ unverified: 'info', verified: 'success', banned: 'danger' } as any)[s] || 'info';
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (searchText.value) params.search = searchText.value;
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await http.get('/admin/users', { params });
    tableData.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function onBan(row: UserRow): Promise<void> {
  await ElMessageBox.confirm(`确认封禁用户 ${row.username}?`, '操作确认');
  await http.put(`/admin/users/${row.id}/ban`, { reason: '管理员操作' });
  ElMessage.success('已封禁');
  loadData();
}

async function onUnban(row: UserRow): Promise<void> {
  await ElMessageBox.confirm(`确认解封用户 ${row.username}?`, '操作确认');
  await http.put(`/admin/users/${row.id}/unban`, {});
  ElMessage.success('已解封');
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
</style>
