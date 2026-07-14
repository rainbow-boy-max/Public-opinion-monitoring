<template>
  <GlassCard title="LLM 大模型管理" icon="🧠" subtitle="9 家国内外厂商 + 自定义 · 支持 OpenAI / Anthropic 协议">
    <template #extra>
      <el-button
        :icon="Refresh"
        :loading="initializing"
        @click="onInitPresets"
        style="margin-right: 8px;"
      >🔁 一键初始化预置</el-button>
      <el-input
        v-model="search"
        placeholder="搜索显示名/模型/厂商"
        clearable
        style="width: 220px; margin-right: 12px;"
        :prefix-icon="Search"
        @input="onSearchInput"
      />
      <el-button type="primary" :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <div v-if="selectedRows.length > 0" class="batch-bar">
      <span class="batch-label">已选 {{ selectedRows.length }} 项</span>
      <el-button
        type="primary"
        :loading="batchLoading"
        @click="onBatch(true)"
      >批量启用</el-button>
      <el-button
        type="warning"
        :loading="batchLoading"
        @click="onBatch(false)"
      >批量禁用</el-button>
      <el-button
        type="danger"
        plain
        :loading="batchLoading"
        @click="onBatch(true, true)"
      >强制启用（含无 Key）</el-button>
      <el-button link @click="onClearSelection">清空选择</el-button>
    </div>

    <el-tabs v-model="activeProvider" class="provider-tabs" @tab-change="onTabChange">
      <el-tab-pane label="全部" name="">
        <ModelsTable
          :items="paginatedItems"
          :total-list="filteredItems"
          @test="onTest"
          @edit="onEdit"
          @delete="onDelete"
          @moveUp="onMoveUp"
          @moveDown="onMoveDown"
          @selectionChange="onSelectionChange"
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
        :label="`${p.displayName} (${byProvider[p.provider]?.length || 0})`"
        :name="p.provider"
      >
        <ModelsTable
          :items="byProvider[p.provider] || []"
          :total-list="byProvider[p.provider] || []"
          @test="onTest"
          @edit="onEdit"
          @delete="onDelete"
          @moveUp="onMoveUp"
          @moveDown="onMoveDown"
          @selectionChange="onSelectionChange"
        />
      </el-tab-pane>
      <el-tab-pane label="添加自定义模型" name="custom">
        <CustomModelForm @saved="loadData" />
      </el-tab-pane>
    </el-tabs>
  </GlassCard>

  <el-dialog
    v-model="editVisible"
    :title="editForm.id ? '编辑模型' : '添加模型'"
    width="760"
  >
    <el-alert
      v-if="editForm.id && editForm.isPreset"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      <template #title>这是系统预置模型</template>
      编辑或删除会覆盖出厂设置；调用「🔁 一键初始化预置」会全部复位。
    </el-alert>

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

      <el-form-item label="API 协议">
        <el-radio-group v-model="editForm.apiStyle">
          <el-radio value="openai">OpenAI 兼容（/chat/completions）</el-radio>
          <el-radio value="anthropic">Anthropic 兼容（/v1/messages）</el-radio>
        </el-radio-group>
        <div class="form-tip">
          选「Anthropic 兼容」时 system 提示词走请求体顶层 + 鉴权用 x-api-key；
          DeepSeek 与 MiniMax 官方支持，其它厂商可指向自建 micro-one-api 等代理。
        </div>
      </el-form-item>

      <el-form-item label="Base URL" prop="baseUrl">
        <div class="base-url-row">
          <el-input
            v-model="editForm.baseUrl"
            placeholder="如：https://api.minimaxi.com/v1"
          />
          <el-button
            v-if="!editForm.id && editForm.baseUrl"
            type="primary"
            :loading="fetching"
            @click="onFetchModels"
          >
            一键获取模型列表
          </el-button>
        </div>
        <div class="form-tip">
          <strong>系统预置 Base URL 仅是默认参考</strong>，可改为自建代理（如 micro-one-api）或官方端点。
          apiStyle=anthropic 时 Base URL 应为根路径（不含 /v1/messages），如 <code>https://api.minimaxi.com/anthropic</code>
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
        <div class="form-tip">
          当前已配置（掩码 {{ editForm.apiKeyMasked || '无' }}）；
          {{ editForm.apiStyle === 'anthropic' ? '走 x-api-key 头' : '走 Authorization: Bearer 头' }}
        </div>
      </el-form-item>

      <el-form-item label="最大输出 Token">
        <el-input-number v-model="editForm.maxTokens" :min="256" :max="200000" :step="256" />
      </el-form-item>

      <el-form-item label="能力">
        <el-checkbox v-model="editForm.vision">📷 图片理解 (vision)</el-checkbox>
        <el-checkbox v-model="editForm.reasoning">🧠 推理/思考 (reasoning)</el-checkbox>
        <el-checkbox v-model="editForm.webSearch">🔍 联网搜索 (webSearch)</el-checkbox>
        <div class="form-tip">
          未勾选任何能力将关闭该模型的能力声明；联网搜索需在
          <el-link type="primary" @click="$router.push('/config/web-search')">「Web 搜索配置」</el-link>
        </div>
      </el-form-item>

      <el-form-item>
        <el-switch v-model="editForm.isEnabled" />
        <span style="margin-left: 8px">启用</span>
        <span
          v-if="!hasApiKey && editForm.id"
          style="margin-left: 12px; color: var(--color-warning); font-size: 12px;"
        >⚠ 当前未配置 API Key，保存后会自动保持"禁用"状态</span>
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
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import ModelsTable from './ModelsTable.vue';
import CustomModelForm from './CustomModelForm.vue';

defineOptions({ name: 'LlmModelsManagementPage' });

interface Provider {
  provider: string;
  displayName: string;
  baseUrl: string;
  apiStyle?: 'openai' | 'anthropic';
  models: Array<{ model: string; displayName: string }>;
}

interface LlmRow {
  id: number;
  provider: string;
  model: string;
  displayName: string;
  baseUrl: string;
  apiVersion: string;
  maxTokens: number;
  isPreset: boolean;
  isEnabled: boolean;
  effectiveState: 'enabled' | 'disabled' | 'disabled_pending_key' | 'enabled_force';
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean };
  apiStyle: 'openai' | 'anthropic';
  sortOrder: number;
}

const tableData = ref<LlmRow[]>([]);
const loading = ref(false);
const initializing = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const search = ref('');
const activeProvider = ref('');

const selectedRows = ref<LlmRow[]>([]);
const batchLoading = ref(false);

const editVisible = ref(false);
const editFormRef = ref<FormInstance>();
const saving = ref(false);
const editForm = reactive<any>({
  id: 0,
  provider: 'openai',
  model: '',
  displayName: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  apiKeyMasked: '',
  maxTokens: 4096,
  isEnabled: true,
  vision: false,
  reasoning: false,
  webSearch: false,
  apiStyle: 'openai',
  isPreset: false,
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
  deepseek_anthropic: 'https://api.deepseek.com/anthropic',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  moonshot: 'https://api.moonshot.cn/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  minimax: 'https://api.minimax.io/v1',
  minimax_anthropic: 'https://api.minimax.io/anthropic',
  custom: '',
};

const byProvider = computed<Record<string, LlmRow[]>>(() => {
  const grouped: Record<string, LlmRow[]> = {};
  for (const m of tableData.value) {
    if (!grouped[m.provider]) grouped[m.provider] = [];
    grouped[m.provider].push(m);
  }
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  return grouped;
});

const filteredItems = computed(() => {
  if (!search.value) return tableData.value;
  const q = search.value.toLowerCase();
  return tableData.value.filter(
    (m) =>
      m.displayName.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q),
  );
});

const filteredTotal = computed(() => filteredItems.value.length);

const paginatedItems = computed(() => {
  const list = filteredItems.value;
  const start = (page.value - 1) * pageSize.value;
  return list.slice(start, start + pageSize.value);
});

const hasApiKey = computed(() => {
  return !!editForm.apiKey || !!editForm.apiKeyMasked;
});

const providers = ref<Provider[]>([]);

async function loadData(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get('/admin/llm-models', {
      params: { page: 1, pageSize: 100 },
    });
    tableData.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadPresets(): Promise<void> {
  try {
    providers.value = await http.get('/admin/llm-models/presets');
  } catch (err) {
    console.error(err);
  }
}

let searchDebounceTimer: number | undefined;
function onSearchInput(): void {
  if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(() => {
    page.value = 1;
  }, 300);
}

function onTabChange(): void {
  /* tab 切换不重拉数据 */
}

function onProviderChange(): void {
  const base = PRESET_BASE_URLS[editForm.provider];
  if (base && !editForm.id) {
    editForm.baseUrl = base;
  }
  const preset = providers.value.find((p) => p.provider === editForm.provider);
  if (preset && !editForm.id) {
    editForm.apiStyle = (preset.apiStyle as 'openai' | 'anthropic') || 'openai';
  }
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

function onEdit(m: LlmRow): void {
  Object.assign(editForm, {
    id: m.id,
    provider: m.provider,
    model: m.model,
    displayName: m.displayName,
    baseUrl: m.baseUrl,
    apiKey: '',
    apiKeyMasked: m.apiKeyMasked,
    maxTokens: m.maxTokens,
    isEnabled: m.isEnabled,
    vision: m.capabilities?.vision || false,
    reasoning: m.capabilities?.reasoning || false,
    webSearch: m.capabilities?.webSearch || false,
    apiStyle: m.apiStyle,
    isPreset: m.isPreset,
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
      const payload: Record<string, unknown> = {
        provider: editForm.provider,
        model: editForm.model,
        displayName: editForm.displayName,
        baseUrl: editForm.baseUrl,
        maxTokens: editForm.maxTokens,
        isEnabled: editForm.isEnabled ? true : false,
        vision: !!editForm.vision,
        reasoning: !!editForm.reasoning,
        webSearch: !!editForm.webSearch,
        apiStyle: editForm.apiStyle,
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

async function onDelete(m: LlmRow): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除 ${m.provider}/${m.model}？${m.isPreset ? '这是预置模型，删除后下次「一键初始化」会重新加入。' : ''}`,
    '删除确认',
    { type: 'warning' },
  );
  try {
    await http.delete(`/admin/llm-models/${m.id}`);
    ElMessage.success('已删除');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

async function onBatch(isEnabled: boolean, force = false): Promise<void> {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择模型');
    return;
  }
  batchLoading.value = true;
  try {
    const ids = selectedRows.value.map((m) => m.id);
    const r: any = await http.put('/admin/llm-models/batch', {
      ids,
      isEnabled,
      force,
    });
    const success = r.successIds?.length || 0;
    const skipped = r.skipped?.length || 0;
    const failed = r.failed?.length || 0;
    let message = '';
    if (failed === 0 && skipped === 0) {
      message = `已${isEnabled ? '启用' : '禁用'} ${success} 项`;
      ElMessage.success(message);
    } else if (success === 0 && failed === 0) {
      message = `已跳过 ${skipped} 项无 API Key`;
      ElMessage.error(message);
    } else {
      const parts: string[] = [];
      if (success > 0) parts.push(`成功 ${success} 项`);
      if (skipped > 0) parts.push(`跳过 ${skipped} 项无 API Key`);
      if (failed > 0) parts.push(`失败 ${failed} 项`);
      message = parts.join('，');
      if (failed > 0) ElMessage.error(message);
      else ElMessage.warning(message);
    }
    onClearSelection();
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '批量操作失败');
  } finally {
    batchLoading.value = false;
  }
}

function onClearSelection(): void {
  selectedRows.value = [];
}

function onSelectionChange(rows: LlmRow[]): void {
  selectedRows.value = rows;
}

async function onMoveUp(row: LlmRow): Promise<void> {
  const list = filteredItems.value;
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx <= 0) return;
  const target = list[idx - 1];
  try {
    await http.put(`/admin/llm-models/${row.id}/sort`, { sortOrder: target.sortOrder });
    ElMessage.success('已上移');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '上移失败');
  }
}

async function onMoveDown(row: LlmRow): Promise<void> {
  const list = filteredItems.value;
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx < 0 || idx >= list.length - 1) return;
  const target = list[idx + 1];
  try {
    await http.put(`/admin/llm-models/${row.id}/sort`, { sortOrder: target.sortOrder });
    ElMessage.success('已下移');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '下移失败');
  }
}

async function onInitPresets(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将清空所有系统预置模型（is_preset=1）并按当前代码重新 seed；自定义模型（is_preset=0）会保留。是否继续？',
      '一键初始化预置',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  initializing.value = true;
  try {
    const r: any = await http.post('/admin/llm-models/init-presets');
    ElMessage.success(
      `已重置预置：移除 ${r.removed}，新增 ${r.added}，保留自定义 ${r.keptCustom}`,
    );
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '初始化失败');
  } finally {
    initializing.value = false;
  }
}

function onTest(m: LlmRow): void {
  currentTestId.value = m.id;
  testPrompt.value = '请用一句话回应：你好';
  testVisible.value = true;
}

async function onDoTest(): Promise<void> {
  testing.value = true;
  try {
    const r: any = await http.post(`/admin/llm-models/${currentTestId.value}/test`, {
      prompt: testPrompt.value,
    });
    testResult.value = r;
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

onMounted(() => {
  loadData();
  loadPresets();
});
</script>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(94, 114, 228, 0.1);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
}

.batch-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary-light);
  margin-right: auto;
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.form-tip code {
  background: rgba(94, 114, 228, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 11px;
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
