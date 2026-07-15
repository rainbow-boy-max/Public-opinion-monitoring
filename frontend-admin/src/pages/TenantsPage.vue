<template>
  <div class="tenants-page">
    <el-card shadow="never" class="tenants-card">
      <template #header>
        <div class="tenants-header">
          <span>租户管理</span>
          <div class="tenants-header__actions">
            <el-tag type="warning" v-if="!tenantEnabled">多租户未启用 (TENANT_ENABLED=false)</el-tag>
            <el-button type="primary" @click="showCreateDialog = true">创建租户</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tenants" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="slug" label="标识" width="160" />
        <el-table-column prop="maxUsers" label="最大用户数" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewTenant(row)">详情</el-button>
            <el-button size="small" @click="editTenant(row)">编辑</el-button>
            <el-button
              size="small"
              :type="row.isActive ? 'warning' : 'success'"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="创建租户" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" placeholder="租户名称" />
        </el-form-item>
        <el-form-item label="标识" required>
          <el-input v-model="createForm.slug" placeholder="唯一标识，如 company-a" />
        </el-form-item>
        <el-form-item label="最大用户数">
          <el-input-number v-model="createForm.maxUsers" :min="1" :max="1000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createTenant" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑租户" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="标识">
          <el-input v-model="editForm.slug" />
        </el-form-item>
        <el-form-item label="最大用户数">
          <el-input-number v-model="editForm.maxUsers" :min="1" :max="1000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateTenant" :loading="updating">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDetailDialog" title="租户详情" width="700px">
      <template v-if="currentTenant">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="ID">{{ currentTenant.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ currentTenant.name }}</el-descriptions-item>
          <el-descriptions-item label="标识">{{ currentTenant.slug }}</el-descriptions-item>
          <el-descriptions-item label="最大用户数">{{ currentTenant.maxUsers }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentTenant.isActive ? 'success' : 'danger'" size="small">
              {{ currentTenant.isActive ? '启用' : '停用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentTenant.createdAt }}</el-descriptions-item>
        </el-descriptions>

        <el-divider>租户用户</el-divider>
        <el-table :data="tenantUsers" v-loading="usersLoading" stripe style="width: 100%">
          <el-table-column prop="id" label="用户ID" width="80" />
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column prop="phone" label="手机号" width="140" />
          <el-table-column prop="authStatus" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.authStatus === 'verified' ? 'success' : 'info'" size="small">
                {{ row.authStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="role" label="角色" width="100" />
          <el-table-column prop="createdAt" label="注册时间" width="180" />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import http from '@/utils/http';

const tenantEnabled = ref(false);
const loading = ref(false);
const creating = ref(false);
const updating = ref(false);
const tenants = ref<any[]>([]);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showDetailDialog = ref(false);
const currentTenant = ref<any>(null);
const tenantUsers = ref<any[]>([]);
const usersLoading = ref(false);

const createForm = ref({
  name: '',
  slug: '',
  maxUsers: 10,
});

const editForm = ref({
  name: '',
  slug: '',
  maxUsers: 10,
});

async function fetchTenants() {
  loading.value = true;
  try {
    const data = await http.get('/tenants');
    tenants.value = data as any[];
  } finally {
    loading.value = false;
  }
}

async function createTenant() {
  if (!createForm.value.name || !createForm.value.slug) return;
  creating.value = true;
  try {
    await http.post('/tenants', createForm.value);
    showCreateDialog.value = false;
    createForm.value = { name: '', slug: '', maxUsers: 10 };
    await fetchTenants();
  } finally {
    creating.value = false;
  }
}

function editTenant(row: any) {
  editForm.value = { name: row.name, slug: row.slug, maxUsers: row.maxUsers };
  currentTenant.value = row;
  showEditDialog.value = true;
}

async function updateTenant() {
  if (!currentTenant.value) return;
  updating.value = true;
  try {
    await http.put(`/tenants/${currentTenant.value.id}`, editForm.value);
    showEditDialog.value = false;
    await fetchTenants();
  } finally {
    updating.value = false;
  }
}

async function viewTenant(row: any) {
  currentTenant.value = row;
  showDetailDialog.value = true;
  usersLoading.value = true;
  try {
    const data = await http.get(`/tenants/${row.id}/users`);
    tenantUsers.value = data as any[];
  } finally {
    usersLoading.value = false;
  }
}

async function toggleActive(row: any) {
  const endpoint = row.isActive ? 'deactivate' : 'activate';
  await http.put(`/tenants/${row.id}/${endpoint}`, {});
  await fetchTenants();
}

onMounted(() => {
  tenantEnabled.value = import.meta.env.VITE_TENANT_ENABLED === 'true';
  fetchTenants();
});
</script>

<style scoped>
.tenants-page {
  padding: 0;
}

.tenants-card {
  border-radius: var(--radius-lg);
}

.tenants-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 600;
}

.tenants-header__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
