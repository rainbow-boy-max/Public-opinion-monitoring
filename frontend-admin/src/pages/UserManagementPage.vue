<template>
  <GlassCard title="用户管理" icon="👥" subtitle="注册用户列表（搜索、分页、封禁/解封操作）">
    <template #extra>
      <el-button type="primary" :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <div class="toolbar">
      <el-input
        v-model="searchText"
        placeholder="搜索用户名或手机号"
        clearable
        style="width: 240px"
        @keyup.enter="loadData"
      >
        <template #prefix><span>🔍</span></template>
      </el-input>
      <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px">
        <el-option label="未认证" value="unverified" />
        <el-option label="已认证" value="verified" />
        <el-option label="已封禁" value="banned" />
      </el-select>
      <el-button type="primary" @click="loadData">查询</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="80">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">#{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="username" label="用户名">
        <template #default="{ row }">
          <div class="user-cell">
            <div class="user-avatar">{{ (row.username || '?').charAt(0).toUpperCase() }}</div>
            <span style="font-weight: 500">{{ row.username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" min-width="120">
        <template #default="{ row }">
          <span class="mono">{{ row.phone }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="realName" label="真实姓名" />
      <el-table-column prop="authStatus" label="认证状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.authStatus)">{{ statusText(row.authStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="170">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">{{ formatDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="170">
        <template #default="{ row }">
          <span class="mono" style="color: var(--text-tertiary)">
            {{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.authStatus !== 'banned'"
            size="small"
            type="danger"
            @click="onBan(row)"
          >
            封禁
          </el-button>
          <el-button v-else size="small" type="success" @click="onUnban(row)">
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
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 24px; justify-content: flex-end"
      @current-change="loadData"
      @size-change="loadData"
    />
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

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

function formatDate(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
    };
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
  await ElMessageBox.confirm(`确认封禁用户 ${row.username}?`, '操作确认', {
    type: 'warning',
    confirmButtonText: '确认封禁',
    cancelButtonText: '取消',
  });
  await http.put(`/admin/users/${row.id}/ban`, { reason: '管理员操作' });
  ElMessage.success('已封禁');
  loadData();
}

async function onUnban(row: UserRow): Promise<void> {
  await ElMessageBox.confirm(`确认解封用户 ${row.username}?`, '操作确认', {
    type: 'success',
    confirmButtonText: '确认解封',
    cancelButtonText: '取消',
  });
  await http.put(`/admin/users/${row.id}/unban`, {});
  ElMessage.success('已解封');
  loadData();
}

onMounted(loadData);
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
}
</style>
