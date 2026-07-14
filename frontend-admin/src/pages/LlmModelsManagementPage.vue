<template>
  <GlassCard title="LLM 大模型管理" icon="🧠" subtitle="内置 6 家厂商 + 自定义，OpenAI 协议一键接入">
    <template #extra>
      <el-input
        v-model="search"
        placeholder="搜索显示名/模型/厂商"
        clearable
        style="width: 240px; margin-right: 12px;"
        :prefix-icon="Search"
        @input="onSearchInput"
      />
      <el-button type="primary" :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <el-tabs v-model="activeProvider" class="provider-tabs" @tab-change="onTabChange">
      <el-tab-pane label="全部" name="">
        <ModelsTable
          :items="paginatedItems"
          @test="onTest"
          @edit="onEdit"
          @delete="onDelete"
        />
        <el-pagination
          v-if="filteredTotal > 0"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="prev, pager, next, total"
          :total="filteredTotal"
          background
          style="margin-top: 16px; justify-content: flex-end;"
        />
      </el-tab-pane>
      <el-tab-pane
        v-for="p in providers"
        :key="p.provider"
        :label="`${p.displayName} (${byProvider.value[p.provider]?.length || 0})`"
        :name="p.provider"
      >
        <ModelsTable
          :items="byProvider.value[p.provider] || []"
          @test="onTest"
          @edit="onEdit"
          @delete="onDelete"
        />
      </el-tab-pane>
      <el-tab-pane label="添加自定义模型" name="custom">
        <CustomModelForm @saved="loadData" />
      </el-tab-pane>
    </el-tabs>
  </GlassCard>

  <el-dialog v-model="editVisible" :title="editForm.id ? '编辑模型' : '添加模型'" width="720">
    <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="140px">
      <el-form-item label="提供商" prop="provider">
        <el-select v-model="editForm.provider" @change="onProviderChange">
          <el-option v-for="p in providers" :key="p.provider" :label="p.displayName" :value="p.provider" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>
      <el-form-item label="模型 ID" prop="model">
        <el-input v-model="editForm.model" placeholder="例如：deepseek-chat" />
      </el-form-item>
      <el-form-item label="显示名称" prop="displayName">
        <el-input v-model="editForm.displayName" placeholder="例如：DeepSeek V3" />
      </el-form-item>
      <el-form-item label="Base URL" prop="baseUrl">
        <div class="base-url-row">
          <el-input v-model="editForm.baseUrl" :disabled="!!editForm.id" placeholder="https://api.deepseek.com/v1" />
          <el-button
            v-if="!editForm.id && editForm.baseUrl"
            type="primary"
            :loading="fetching"
            @click="onFetchModels"
          >
            一键获取模型列表
          </el-button>
        </div>
      </el-form-item>
      <el-form-item v-if="!editForm.id && availableModels.length > 0" label="选择模型">
        <el-button
          v-for="m in availableModels"
          :key="m"
          size="small"
          @click="onPickPreset(m)"
          style="margin: 4px"
        >
          {{ m }}
        </el-button>
      </el-form-item>
      <el-form-item label="API Key" prop="apiKey">
        <el-input
          v-model="editForm.apiKey"
          show-password
          placeholder="请输入 API Key，留空保持原值"
        />
      </el-form-item>
      <el-form-item label="最大输出 Token">
        <el-input-number v-model="editForm.maxTokens" :min="256" :max="200000" :step="256" />
      </el-form-item>
      <el-form-item>
        <el-switch v-model="editForm.isEnabled" />
        <span style="margin-left: 8px">启用</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="testVisible" title="测试模型连接" width="640">
    <el-form label-width="100px">
      <el-form-item label="测试 Prompt">
        <el-input
          v-model="testPrompt"
          type="textarea"
          :rows="3"
          placeholder="请用一句话回答"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="testVisible = false">关闭</el-button>
      <el-button type="primary" :loading="testing" @click="onDoTest">运行测试</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="testResultVisible" title="测试结果" width="640">
    <el-result v-if="testResult?.ok" icon="success" :title="`成功 · ${testResult.latencyMs}ms`">
      <template #sub-title>
        <pre style="white-space: pre-wrap; color: var(--text-secondary); padding: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; max-height: 320px; overflow-y: auto; text-align: left;">{{ testResult.output }}</pre>
      </template>
    </el-result>
    <el-result v-else icon="error" :title="`失败 · ${testResult?.latencyMs || 0}ms`">
      <template #sub-title>
        <pre style="white-space: pre-wrap; color: #f87171;">{{ testResult?.error }}</pre>
      </template>
    </el-result>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'LlmModelsManagementPage' });
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import ModelsTable from './ModelsTable.vue';
import CustomModelForm from './CustomModelForm.vue';

interface LlmModel {
  id: number;
  provider: string;
  model: string;
  displayName: string;
  baseUrl: string;
  apiVersion: string;
  maxTokens: number;
  isPreset: boolean;
  isEnabled: boolean;
  apiKeyMasked: string;
  apiKeyConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
}

interface Provider {
  provider: string;
  displayName: string;
  baseUrl: string;
  models: Array<{ model: string; displayName: string }>;
}

const tableData = ref<LlmModel[]>([]);
const providers = ref<Provider[]>([]);
const activeProvider = ref('');

const page = ref(1);
const pageSize = ref(20);
const search = ref('');

const editVisible = ref(false);
const editFormRef = ref<FormInstance>();
const saving = ref(false);
const editForm = reactive({
  id: 0,
  provider: 'openai',
  model: '',
  displayName: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  maxTokens: 4096,
  isEnabled: true,
});

const fetching = ref(false);
const availableModels = ref<string[]>([]);

const testVisible = ref(false);
const testing = ref(false);
const testPrompt = ref('请用一句话回答');
const currentTestId = ref(0);

const testResultVisible = ref(false);
const testResult = ref<any>(null);

const editRules = {
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  model: [{ required: true, message: '请输入模型 ID', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
};

const PRESET_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  custom: '',
};

const byProvider = computed<Record<string, LlmModel[]>>(() => {
  const grouped: Record<string, LlmModel[]> = {};
  for (const m of tableData.value) {
    if (!grouped[m.provider]) grouped[m.provider] = [];
    grouped[m.provider].push(m);
  }
  return grouped;
});

const filteredTotal = computed(() => {
  if (!search.value) return tableData.value.length;
  const q = search.value.toLowerCase();
  return tableData.value.filter(
    (m) =>
      m.displayName.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q),
  ).length;
});

const paginatedItems = computed(() => {
  let list = tableData.value;
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }
  const start = (page.value - 1) * pageSize.value;
  return list.slice(start, start + pageSize.value);
});

let searchDebounceTimer: number | undefined;
function onSearchInput(): void {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    page.value = 1;
  }, 300);
}

function onTabChange(): void {
  /* tab 切换不再重拉数据，仅切换显示 */
}

async function loadData(): Promise<void> {
  try {
    const res = await http.get('/admin/llm-models', {
      params: { page: 1, pageSize: 100 },
    });
    tableData.value = res.items;
    providers.value = await http.get('/admin/llm-models/presets');
  } catch (err) {
    console.error(err);
  }
}

function onProviderChange(p: string): void {
  editForm.baseUrl = PRESET_BASE_URLS[p] || '';
  availableModels.value = [];
}

async function onFetchModels(): Promise<void> {
  if (!editForm.baseUrl) {
    ElMessage.warning('请先填写 Base URL');
    return;
  }
  if (!editForm.apiKey) {
    ElMessage.warning('请先输入 API Key 用于拉取');
    return;
  }
  fetching.value = true;
  try {
    const res = await http.post('/admin/llm-models/fetch-models', {
      baseUrl: editForm.baseUrl,
      apiKey: editForm.apiKey,
    });
    availableModels.value = res.models;
    ElMessage.success(`找到 ${res.count} 个模型，点击下方按钮选择`);
  } catch (err: any) {
    ElMessage.error(err?.message || '获取模型列表失败');
    availableModels.value = [];
  } finally {
    fetching.value = false;
  }
}

function onPickPreset(modelId: string): void {
  editForm.model = modelId;
  editForm.displayName = modelId;
  ElMessage.success(`已选择 ${modelId}`);
}

function onEdit(m: LlmModel): void {
  Object.assign(editForm, {
    id: m.id,
    provider: m.provider,
    model: m.model,
    displayName: m.displayName,
    baseUrl: m.baseUrl,
    apiKey: '',
    maxTokens: m.maxTokens,
    isEnabled: m.isEnabled,
  });
  availableModels.value = [];
  editVisible.value = true;
}

async function onSave(): Promise<void> {
  if (!editFormRef.value) return;
  await editFormRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      const payload: any = {
        provider: editForm.provider,
        model: editForm.model,
        displayName: editForm.displayName,
        baseUrl: editForm.baseUrl,
        maxTokens: editForm.maxTokens,
        isEnabled: editForm.isEnabled ? true : false,
      };
      if (editForm.apiKey) payload.apiKey = editForm.apiKey;
      if (editForm.id) {
        await http.put(`/admin/llm-models/${editForm.id}`, payload);
      } else {
        await http.post('/admin/llm-models', payload);
      }
      ElMessage.success('保存成功');
      editVisible.value = false;
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

async function onDelete(m: LlmModel): Promise<void> {
  await ElMessageBox.confirm(`确认删除 ${m.provider}/${m.model}？`, '删除确认', {
    type: 'warning',
  });
  try {
    await http.delete(`/admin/llm-models/${m.id}`);
    ElMessage.success('已删除');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

function onTest(m: LlmModel): void {
  currentTestId.value = m.id;
  testPrompt.value = '请用一句话回应：你好';
  testVisible.value = true;
}

async function onDoTest(): Promise<void> {
  testing.value = true;
  try {
    const res = await http.post(`/admin/llm-models/${currentTestId.value}/test`, {
      prompt: testPrompt.value,
    });
    testResult.value = res;
    testVisible.value = false;
    testResultVisible.value = true;
    loadData();
  } catch (err: any) {
    testResult.value = {
      ok: false,
      latencyMs: 0,
      error: err?.message || '测试失败',
    };
    testVisible.value = false;
    testResultVisible.value = true;
  } finally {
    testing.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.provider-tabs :deep(.el-tabs__nav-wrap::after) {
  background: transparent;
}

.provider-tabs :deep(.el-tabs__item) {
  color: var(--text-secondary);
  font-weight: 500;
}

.provider-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-light);
}

.base-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.base-url-row .el-input {
  flex: 1;
}
</style>
