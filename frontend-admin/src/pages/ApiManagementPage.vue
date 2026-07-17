<template>
  <div class="api-mgmt">
    <GlassCard title="API 密钥管理" subtitle="管理 Open API 访问密钥">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="showCreate = true">新建密钥</el-button>
      </template>

      <el-table :data="keys" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column label="密钥" width="200">
          <template #default="{ row }">
            <code style="font-size: 11px; background: var(--bg-subtle); padding: 2px 6px; border-radius: 4px;">
              {{ maskKey(row.key) }}
            </code>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="速率限制" width="100">
          <template #default="{ row }">{{ row.rateLimit }}/min</template>
        </el-table-column>
        <el-table-column label="最后使用" width="160">
          <template #default="{ row }">{{ row.lastUsedAt ? formatDate(row.lastUsedAt) : '--' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="onToggle(row)">
              {{ row.isActive ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" type="danger" @click="onRevoke(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && keys.length === 0" description="暂无 API 密钥" />
    </GlassCard>

    <GlassCard title="使用统计" subtitle="API 调用概览" class="api-mgmt__stats">
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="api-mgmt__stat-card">
            <div class="api-mgmt__stat-value">{{ stats.totalKeys }}</div>
            <div class="api-mgmt__stat-label">密钥总数</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="api-mgmt__stat-card">
            <div class="api-mgmt__stat-value">{{ stats.activeKeys }}</div>
            <div class="api-mgmt__stat-label">活跃密钥</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="api-mgmt__stat-card">
            <div class="api-mgmt__stat-value">{{ stats.totalCalls }}</div>
            <div class="api-mgmt__stat-label">总调用次数</div>
          </div>
        </el-col>
      </el-row>
    </GlassCard>

    <GlassCard title="API 使用指南" subtitle="快速开始使用 Open API">
      <div class="api-mgmt__guide">
        <h4>认证方式</h4>
        <p>在请求头中添加 <code>X-API-Key</code> 即可认证：</p>
        <pre>curl -H "X-API-Key: your-api-key-here" https://your-domain.com/api/v1/...</pre>

        <h4>速率限制</h4>
        <p>每个密钥默认每分钟最多 100 次请求。超出限制返回 HTTP 429。</p>

        <h4>错误码</h4>
        <ul>
          <li><code>401</code> - API Key 无效或已禁用</li>
          <li><code>429</code> - 请求频率超限</li>
          <li><code>500</code> - 服务器内部错误</li>
        </ul>
      </div>
    </GlassCard>

    <el-dialog v-model="showCreate" title="新建 API 密钥" width="500">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：生产环境" />
        </el-form-item>
        <el-form-item label="速率限制">
          <el-input-number v-model="form.rateLimit" :min="1" :max="10000" />
          <span style="margin-left: 8px; color: var(--text-tertiary);">次/分钟</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showKey" title="密钥已创建" width="500">
      <div class="api-mgmt__new-key">
        <p style="color: var(--color-warning); font-weight: 600;">请立即复制此密钥，关闭后将无法再次查看。</p>
        <div class="api-mgmt__key-display">
          <code>{{ newKey }}</code>
          <el-button size="small" @click="copyKey">复制</el-button>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showKey = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ApiManagementPage' });

import { ref, onMounted } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import { ElMessage, ElMessageBox } from 'element-plus';

interface ApiKey {
  id: number;
  name: string;
  key: string;
  isActive: number;
  rateLimit: number;
  lastUsedAt: string | null;
  createdAt: string;
}

const loading = ref(false);
const keys = ref<ApiKey[]>([]);
const showCreate = ref(false);
const creating = ref(false);
const showKey = ref(false);
const newKey = ref('');

const form = ref({ name: '', rateLimit: 100 });
const formRules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] };

const stats = ref({ totalKeys: 0, activeKeys: 0, totalCalls: 0 });

function maskKey(k: string): string {
  if (k.length <= 8) return '****';
  return k.substring(0, 8) + '****' + k.substring(k.length - 4);
}

function formatDate(d: string | null): string {
  if (!d) return '--';
  const dt = new Date(d);
  return dt.toLocaleString('zh-CN', { hour12: false });
}

async function loadKeys() {
  loading.value = true;
  try {
    keys.value = await http.get('/api-keys') as ApiKey[];
    stats.value = await http.get('/api-keys/stats') as any;
  } catch { /* silent */ }
  loading.value = false;
}

async function onCreate() {
  creating.value = true;
  try {
    const result = await http.post('/api-keys', form.value) as any;
    newKey.value = result.key;
    showCreate.value = false;
    showKey.value = true;
    form.value = { name: '', rateLimit: 100 };
    await loadKeys();
  } catch { /* silent */ }
  creating.value = false;
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value);
  ElMessage.success('已复制到剪贴板');
}

async function onToggle(row: ApiKey) {
  try {
    await http.patch(`/api-keys/${row.id}/toggle`);
    row.isActive = row.isActive ? 0 : 1;
  } catch { /* silent */ }
}

async function onRevoke(row: ApiKey) {
  try {
    await ElMessageBox.confirm(`确定删除密钥 "${row.name}"？`, '确认');
    await http.delete(`/api-keys/${row.id}`);
    await loadKeys();
    ElMessage.success('已删除');
  } catch { /* cancelled */ }
}

onMounted(loadKeys);
</script>

<style scoped>
.api-mgmt__stats {
  margin-top: 16px;
}

.api-mgmt__stat-card {
  background: var(--bg-subtle);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
}

.api-mgmt__stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary);
}

.api-mgmt__stat-label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.api-mgmt__guide {
  font-size: 14px;
  line-height: 1.8;
}

.api-mgmt__guide h4 {
  margin: 16px 0 8px;
  color: var(--text-primary);
}

.api-mgmt__guide pre {
  background: var(--bg-subtle);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}

.api-mgmt__guide code {
  background: var(--bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.api-mgmt__new-key p {
  margin-bottom: 12px;
}

.api-mgmt__key-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-subtle);
  padding: 12px;
  border-radius: 6px;
}

.api-mgmt__key-display code {
  flex: 1;
  font-size: 12px;
  word-break: break-all;
}
</style>
