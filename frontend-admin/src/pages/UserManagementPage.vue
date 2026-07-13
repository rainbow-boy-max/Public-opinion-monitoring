<template>
  <GlassCard title="用户管理" icon="👥" subtitle="注册用户列表（创建、重置密码、封禁/解封、删除）">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增用户</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
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
      <el-table-column label="操作" width="340" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDetailDialog(row)">详情</el-button>
          <el-button size="small" type="warning" @click="onResetPassword(row)">重置密码</el-button>
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
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
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

  <!-- 用户详情 -->
  <el-dialog v-model="detailVisible" title="用户详情" width="640">
    <el-descriptions v-if="detailData" :column="2" border>
      <el-descriptions-item label="用户名">{{ detailData.username }}</el-descriptions-item>
      <el-descriptions-item label="手机号">
        <code class="mono">{{ detailData.phone }}</code>
      </el-descriptions-item>
      <el-descriptions-item label="认证状态">
        <el-tag :type="getStatusTagType(detailData.authStatus)">
          {{ statusText(detailData.authStatus) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="实名认证">
        <el-tag v-if="detailData.idCardHash" type="success" size="small">已认证</el-tag>
        <el-tag v-else type="info" size="small">未认证</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="登录失败次数">{{ detailData.loginAttempts }}</el-descriptions-item>
      <el-descriptions-item label="锁定到期">{{ detailData.lockedUntil ? new Date(detailData.lockedUntil).toLocaleString('zh-CN') : '-' }}</el-descriptions-item>
      <el-descriptions-item label="最后登录">{{ detailData.lastLoginAt ? new Date(detailData.lastLoginAt).toLocaleString('zh-CN') : '-' }}</el-descriptions-item>
      <el-descriptions-item label="注册时间">{{ new Date(detailData.createdAt).toLocaleString('zh-CN') }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>

  <!-- 新增用户 -->
  <el-dialog v-model="createVisible" title="新增用户" width="560">
    <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="createForm.username" placeholder="3-64 字符" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="createForm.phone" placeholder="11 位中国大陆手机号" />
      </el-form-item>
      <el-form-item label="初始密码" prop="password">
        <el-input v-model="createForm.password" type="password" show-password placeholder="6-64 字符" />
      </el-form-item>
      <el-form-item label="用户角色">
        <el-radio-group v-model="createForm.role">
          <el-radio value="user">普通用户</el-radio>
          <el-radio value="operator">运营</el-radio>
          <el-radio value="admin">管理员</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="初始认证">
        <el-select v-model="createForm.authStatus" style="width: 100%">
          <el-option label="未认证" value="unverified" />
          <el-option label="已认证" value="verified" />
          <el-option label="已封禁" value="banned" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>

  <!-- 重置密码结果 -->
  <el-dialog v-model="resetVisible" title="密码已重置" width="520">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="⚠️ 请将临时密码安全告知用户，首次登录后会要求修改"
    >
      <p style="margin: 12px 0; font-size: 16px">
        用户：<strong>{{ resetData?.username }}</strong>
      </p>
      <p>
        临时密码：
        <code class="temp-pwd">{{ resetData?.tempPassword }}</code>
        <el-button size="small" @click="onCopy" style="margin-left: 12px">复制</el-button>
      </p>
    </el-alert>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Refresh, Plus } from '@element-plus/icons-vue';
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

// === 用户管理增强功能 ===

const detailVisible = ref(false);
const detailData = ref<any>(null);

const createVisible = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  username: '',
  phone: '',
  password: '',
  role: 'user',
  authStatus: 'unverified',
});
const createRules = {
  username: [{ required: true, min: 3, max: 64, message: '账号 3-64 字符', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码 6-64 字符', trigger: 'blur' },
  ],
};

const resetVisible = ref(false);
const resetData = ref<{ username: string; tempPassword: string } | null>(null);

async function openDetailDialog(row: UserRow): Promise<void> {
  try {
    const d = await http.get(`/admin/users/${row.id}/detail`);
    detailData.value = d;
    detailVisible.value = true;
  } catch (err: any) {
    ElMessage.error(err?.message || '获取详情失败');
  }
}

function openCreateDialog(): void {
  Object.assign(createForm, {
    username: '',
    phone: '',
    password: '',
    role: 'user',
    authStatus: 'unverified',
  });
  createVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;
    creating.value = true;
    try {
      const res = await http.post('/admin/users', {
        username: createForm.username,
        phone: createForm.phone,
        password: createForm.password,
        role: createForm.role,
        authStatus: createForm.authStatus,
      });
      ElMessage.success(`用户 ${res.username} 创建成功（初始密码已加密存储）`);
      createVisible.value = false;
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '创建失败');
    } finally {
      creating.value = false;
    }
  });
}

async function onResetPassword(row: UserRow): Promise<void> {
  await ElMessageBox.confirm(
    `确认重置用户 ${row.username} 的密码？将生成临时密码并强制首次登录修改。`,
    '重置密码',
    { type: 'warning' },
  );
  try {
    const res = await http.post(`/admin/users/${row.id}/reset-password`, {});
    resetData.value = { username: row.username, tempPassword: res.tempPassword };
    resetVisible.value = true;
    ElMessage.success('密码已重置');
  } catch (err: any) {
    ElMessage.error(err?.message || '重置失败');
  }
}

async function onCopy(): Promise<void> {
  if (!resetData.value) return;
  await navigator.clipboard?.writeText(resetData.value.tempPassword);
  ElMessage.success('临时密码已复制');
}

async function onDelete(row: UserRow): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除用户 ${row.username}？此操作不可恢复，会同时取消其所有监控任务。`,
    '删除用户',
    { type: 'error' },
  );
  try {
    await http.delete(`/admin/users/${row.id}`);
    ElMessage.success('已删除');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}
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

.temp-pwd {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-warning);
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 12px;
  border-radius: 6px;
  letter-spacing: 2px;
}
</style>
