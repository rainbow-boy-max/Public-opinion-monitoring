<template>
  <div class="agent-detail">
    <GlassCard :title="agent?.name ? `${agent.name} - 智能体详情` : '创建新智能体'" :icon="agent ? '🤖' : '✨'">
      <template #extra>
        <el-button type="primary" plain :loading="savingAll" :disabled="isNew && !formRef" @click="onSaveAll">
          保存全部
        </el-button>
        <el-button v-if="!isNew" @click="$router.push('/agents')" style="margin-left: 8px;">返回列表</el-button>
      </template>

      <el-tabs
        v-model="activeTab"
        class="detail-tabs"
        @tab-click="onTabClick"
      >
        <!-- Tab 1: 基础配置 -->
        <el-tab-pane label="基础配置" name="basic" :key="'t-basic'">
          <el-form :model="form" :rules="rules" label-width="140px" ref="formRef">
            <el-form-item label="智能体名称" prop="name">
              <el-input v-model="form.name" placeholder="如：舆情危机公关顾问" />
            </el-form-item>
            <el-form-item label="角色描述" prop="roleDescription">
              <el-input
                v-model="form.roleDescription"
                type="textarea"
                :rows="2"
                placeholder="简短描述，例如：协助处理品牌负面舆情，输出专业公关方案"
              />
            </el-form-item>
            <el-form-item label="系统 Prompt">
              <el-input
                v-model="form.systemPrompt"
                type="textarea"
                :rows="8"
                placeholder="详细的角色 + 任务 + 输出格式 + 风格要求"
                style="font-family: 'JetBrains Mono', monospace; font-size: 13px;"
              />
            </el-form-item>
            <el-form-item label="温度">
              <el-slider v-model="form.temperature" :min="0" :max="2" :step="0.1" style="width: 320px;" />
              <span style="margin-left: 16px; color: var(--text-tertiary);">{{ form.temperature }}</span>
            </el-form-item>
            <el-form-item label="最大 Token">
              <el-input-number v-model="form.maxTokens" :min="256" :max="32000" :step="256" />
            </el-form-item>
            <el-form-item label="启用">
              <el-switch v-model="enabledSwitch" />
              <span style="margin-left: 8px; color: var(--text-tertiary)">{{ enabledSwitch ? '已启用' : '已禁用' }}</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="onSave">保存基础配置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- Tab 2: 模型选择 -->
        <el-tab-pane label="大模型选择" name="models" :key="'t-models'">
          <el-form label-width="140px">
            <el-form-item label="主用大模型">
              <el-select
                v-model="form.primaryModelId"
                filterable
                placeholder="选择主用大模型（必填）"
                style="width: 100%"
              >
                <el-option-group
                  v-for="p in configuredProviders"
                  :key="p.provider"
                  :label="p.label"
                >
                  <el-option
                    v-for="m in p.models"
                    :key="m.id"
                    :label="`${m.displayName} (${m.model})`"
                    :value="m.id"
                  >
                    <span style="float: left">{{ m.displayName }}</span>
                    <span style="float: right; color: var(--text-tertiary); font-family: monospace; font-size: 12px;">{{ m.model }}</span>
                  </el-option>
                </el-option-group>
              </el-select>
              <div class="form-tip">主用模型不可用时自动降级到备用模型链</div>
            </el-form-item>
            <el-form-item label="备用大模型">
              <el-select
                v-model="form.fallbackModelIds"
                multiple
                filterable
                placeholder="可选多个备用模型，按列表顺序 failover"
                style="width: 100%"
              >
                <el-option-group
                  v-for="p in configuredProviders"
                  :key="p.provider"
                  :label="p.label"
                >
                  <el-option
                    v-for="m in p.models"
                    :key="m.id"
                    :label="`${m.displayName} (${m.model})`"
                    :value="m.id"
                  />
                </el-option-group>
              </el-select>
              <div class="form-tip">最多 5 个，按顺序逐个尝试</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onSaveModels">保存模型设置</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
            没有合适的模型？去 <el-link @click="$router.push('/llm-models')" type="primary">模型管理</el-link>
            配置新的提供商（支持 OpenAI / DeepSeek / 通义千问 / 智谱 / Kimi / 硅基流动）
          </el-alert>
        </el-tab-pane>

        <!-- Tab 3: 知识库关联 -->
        <el-tab-pane label="知识库" name="kb" :disabled="isNew" :key="'t-kb'">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            <template #title>智能体 ↔ 知识库多对多关联</template>
            从下方列表勾选已就绪的知识库，AI 会在对话时同时检索所有关联知识库。
            <el-link
              type="primary"
              @click="$router.push('/knowledge')"
              style="margin-left: 8px"
            >去管理知识库 →</el-link>
          </el-alert>

          <el-form label-width="120px" :rules="kbRules" :model="form" ref="kbFormRef">
            <el-form-item label="启用知识库" prop="kbEnabled">
              <el-switch v-model="form.kbEnabled" />
              <span style="margin-left: 12px">开启后 AI 会基于知识库内容回答</span>
            </el-form-item>
            <el-form-item label="检索 Top K">
              <el-input-number v-model="form.kbTopK" :min="1" :max="10" />
              <span style="margin-left: 12px; color: var(--text-tertiary)">
                每个知识库返回的分块数
              </span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onSaveKb">保存知识库设置</el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <h3 style="color: var(--text-primary); font-size: 16px; margin: 16px 0">
            📚 已就绪知识库（多选）
          </h3>

          <div v-if="allKbs.length === 0" class="kb-empty">
            <div class="kb-empty__icon">📭</div>
            <div>还没有可用的知识库</div>
            <el-button
              type="primary"
              size="small"
              style="margin-top: 12px"
              @click="$router.push('/knowledge')"
            >
              去创建知识库
            </el-button>
          </div>

          <div v-else class="kb-select-grid">
            <el-checkbox-group v-model="form.knowledgeBaseIds" @change="onKbSelectChange">
              <label
                v-for="kb in allKbs"
                :key="kb.id"
                class="kb-select-card"
                :class="{ 'kb-select-card--selected': form.knowledgeBaseIds.includes(kb.id) }"
              >
                <el-checkbox :value="kb.id" size="large" />
                <div class="kb-select-card__icon" :style="{ background: domainColor(kb.domain) }">
                  <span>{{ domainIcon(kb.domain) }}</span>
                </div>
                <div class="kb-select-card__content">
                  <div class="kb-select-card__name">{{ kb.name }}</div>
                  <div class="kb-select-card__meta">
                    <span>📁 {{ kb.fileCount }}</span>
                    <span style="margin-left: 8px">⭐ {{ kb.aiScore !== null ? Math.round(kb.aiScore) : '—' }}</span>
                  </div>
                </div>
              </label>
            </el-checkbox-group>
          </div>

          <div v-if="form.knowledgeBaseIds.length > 0" class="kb-summary">
            <el-alert type="success" :closable="false" show-icon>
              <template #title>
                已选择 {{ form.knowledgeBaseIds.length }} 个知识库
              </template>
              <el-button
                type="primary"
                size="small"
                style="margin-top: 8px"
                :loading="savingKbBindings"
                @click="onSaveKbBindings"
              >
                保存关联
              </el-button>
            </el-alert>
          </div>
        </el-tab-pane>

        <!-- Tab 4: 测试运行 -->
        <el-tab-pane label="测试运行" name="test" :disabled="isNew" :key="'t-test'">
          <el-form label-width="100px">
            <el-form-item label="测试输入">
              <el-input
                v-model="testInput"
                type="textarea"
                :rows="4"
                placeholder="输入问题或舆情事件，AI 将使用此智能体来回答"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="running" @click="onRunTest">运行</el-button>
              <el-button @click="testOutput = ''">清空</el-button>
              <el-switch
                v-model="streamSwitch"
                style="margin-left: 20px"
                active-text="流式输出"
              />
            </el-form-item>
            <el-form-item v-if="testMeta.modelUsed || testMeta.latencyMs" label="运行信息">
              <div class="run-meta">
                <span v-if="testMeta.modelUsed">模型：<strong>{{ testMeta.modelUsed }}</strong></span>
                <span v-if="testMeta.latencyMs"> 耗时：<strong>{{ testMeta.latencyMs }} ms</strong></span>
                <span v-if="testMeta.tokensUsed"> Tokens：<strong>{{ testMeta.tokensUsed }}</strong></span>
              </div>
            </el-form-item>
            <el-form-item label="输出">
              <div class="test-output">{{ testOutput || '运行结果将在这里显示' }}</div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AgentDetailPage' });
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const route = useRoute();
const router = useRouter();
const agentId = computed(() => Number(route.params.id) || 0);
const isNew = computed(() => route.name === 'agent-new' || !agentId.value);

const formRef = ref<FormInstance>();
const kbFormRef = ref<FormInstance>();
const activeTab = ref('basic');
const saving = ref(false);

const agent = ref<any>(null);
const form = reactive({
  name: '',
  roleDescription: '',
  systemPrompt: '',
  primaryModelId: 0,
  fallbackModelIds: [] as number[],
  temperature: 0.7,
  maxTokens: 2048,
  kbEnabled: true,
  kbTopK: 4,
  knowledgeBaseIds: [] as number[],
  status: 'enabled',
});
const enabledSwitch = ref(true);

const allModels = ref<any[]>([]);
const allKbs = ref<any[]>([]);
const savingKbBindings = ref(false);

const configuredProviders = computed(() => {
  const grouped: Record<string, { label: string; models: any[] }> = {};
  for (const m of allModels.value) {
    if (!m.apiKeyConfigured) continue;
    const key = m.provider;
    if (!grouped[key]) grouped[key] = { label: m.provider, models: [] };
    grouped[key].models.push(m);
  }
  return Object.entries(grouped).map(([k, v]) => ({
    provider: k,
    label: PROVIDER_LABEL[k] || k,
    models: v.models,
  }));
});

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  dashscope: '阿里云百炼 (通义千问)',
  zhipu: '智谱 AI (GLM)',
  moonshot: '月之暗面 Kimi',
  siliconflow: '硅基流动',
  custom: '自定义',
};

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  roleDescription: [{ required: true, message: '请输入角色描述', trigger: 'blur' }],
};

const kbRules = {
  kbEnabled: [
    {
      validator: (_rule: unknown, _value: unknown, cb: (err?: Error) => void) => {
        if (form.kbEnabled && form.knowledgeBaseIds.length < 1) {
          return cb(new Error('开启知识库时至少勾选 1 个'));
        }
        cb();
      },
      trigger: 'change',
    },
  ],
};

function validateKb(): boolean {
  if (!form.kbEnabled) return true;
  if (form.knowledgeBaseIds.length < 1) {
    ElMessage.error('开启知识库时至少勾选 1 个');
    return false;
  }
  return true;
}

const kbFiles = ref<any[]>([]);
const kbLoading = ref(false);
const testInput = ref('');
const testOutput = ref('');
const testMeta = reactive<{ modelUsed?: string; latencyMs?: number; tokensUsed?: number }>({});
const running = ref(false);
const streamSwitch = ref(true);

function statusLabel(s: string): string {
  return ({ pending: '等待中', parsing: '解析中', ready: '就绪', failed: '失败' } as any)[s] || s;
}

function statusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ pending: 'info', parsing: 'warning', ready: 'success', failed: 'danger' } as any)[s] || 'info';
}

async function loadAgent(): Promise<void> {
  if (isNew.value) return;
  try {
    const a = await http.get(`/agents/${agentId.value}`);
    agent.value = a;
    Object.assign(form, {
      name: a.name,
      roleDescription: a.roleDescription,
      systemPrompt: a.systemPrompt || '',
      primaryModelId: a.primaryModelId,
      fallbackModelIds: a.fallbackModelIds || [],
      temperature: a.temperature,
      maxTokens: a.maxTokens,
      kbEnabled: a.kbEnabled === 1,
      kbTopK: a.kbTopK,
      status: a.status,
    });
    enabledSwitch.value = a.status === 'enabled';
  } catch (err) {
    console.error(err);
  }
}

async function loadModels(): Promise<void> {
  try {
    const res = await http.get('/admin/llm-models', { params: { page: 1, pageSize: 100 } });
    allModels.value = res.items;
  } catch (err) {
    console.error(err);
  }
}

async function loadAllKbs(): Promise<void> {
  try {
    const list = (await http.get('/admin/knowledge/available')) as Array<Record<string, unknown>>;
    allKbs.value = (list || []).map((kb) => ({ ...kb, id: Number(kb.id) }));
  } catch (err) {
    console.error(err);
  }
}

async function loadAgentKbBindings(): Promise<void> {
  if (isNew.value) return;
  try {
    const ids = (await http.get(`/admin/agents/${agentId.value}/knowledge-bases`)) as Array<unknown>;
    form.knowledgeBaseIds = Array.isArray(ids) ? ids.map((n) => Number(n)) : [];
  } catch (err) {
    form.knowledgeBaseIds = [];
  }
}

function domainIcon(d: string | null | undefined): string {
  const m: Record<string, string> = {
    technology: '💻', finance: '💰', medical: '🏥', legal: '⚖️',
    education: '📚', media: '📺', general: '🌐',
  };
  return m[d || 'general'] || '📁';
}

function domainColor(d: string | null | undefined): string {
  const m: Record<string, string> = {
    technology: 'linear-gradient(135deg, #5E72E4, #7C3AED)',
    finance: 'linear-gradient(135deg, #10B981, #059669)',
    medical: 'linear-gradient(135deg, #EF4444, #DC2626)',
    legal: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    education: 'linear-gradient(135deg, #F59E0B, #D97706)',
    media: 'linear-gradient(135deg, #EC4899, #BE185D)',
    general: 'linear-gradient(135deg, #6B7280, #4B5563)',
  };
  return m[d || 'general'];
}

function onKbSelectChange(): void { /* 实时同步到 form */ }

async function onSaveKbBindings(): Promise<void> {
  savingKbBindings.value = true;
  try {
    await http.post(`/admin/agents/${agentId.value}/knowledge-bases`, {
      kbIds: form.knowledgeBaseIds,
    });
    ElMessage.success(`已保存 ${form.knowledgeBaseIds.length} 个知识库关联`);
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    savingKbBindings.value = false;
  }
}

function onTabClick(tab: any): void {
  // 强制同步 activeTab（防止 Element Plus 在某种情况下吞掉切换事件）
  if (tab && tab.props && tab.props.name) {
    activeTab.value = tab.props.name;
  }
  // KB Tab 切到时按需加载
  if (tab.props.name === 'kb' && allKbs.value.length === 0) {
    loadAllKbs();
  }
  // 跳转新智能体时强制重置
  if (tab.props.name === 'kb' && !isNew.value) {
    loadAgentKbBindings();
  }
}

async function onSave(): Promise<void> {
  if (!formRef.value) return;
  if (!validateKb()) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      const payload = {
        ...form,
        status: enabledSwitch.value ? 'enabled' : 'disabled',
      };
      if (isNew.value) {
        const r = await http.post('/agents', payload);
        const newId = r?.id ?? r?.agentId ?? r?.data?.id;
        if (!newId) {
          throw new Error('创建成功但未返回 id');
        }
        ElMessage.success('创建成功');
        router.push(`/agents/${newId}`);
      } else {
        await http.put(`/agents/${agentId.value}`, payload);
        ElMessage.success('已保存');
        loadAgent();
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

const savingAll = ref(false);

async function onSaveAll(): Promise<void> {
  if (!formRef.value) return;
  if (!validateKb()) return;
  const validated = await new Promise<boolean>((resolve) => {
    formRef.value!.validate((valid) => resolve(!!valid));
  });
  if (!validated) {
    ElMessage.error('基础配置校验未通过，请先完善');
    return;
  }

  const steps: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: '基础配置',
      run: async () => {
        const payload = { ...form, status: enabledSwitch.value ? 'enabled' : 'disabled' };
        if (isNew.value) {
          const r = await http.post('/agents', payload);
          const newId = r?.id ?? r?.agentId ?? r?.data?.id;
          if (!newId) throw new Error('创建成功但未返回 id');
          router.push(`/agents/${newId}`);
        } else {
          await http.put(`/agents/${agentId.value}`, payload);
        }
      },
    },
  ];
  if (!isNew.value) {
    steps.push({
      name: '模型设置',
      run: () => http.put(`/agents/${agentId.value}`, {
        primaryModelId: form.primaryModelId,
        fallbackModelIds: form.fallbackModelIds,
      }) as unknown as Promise<void>,
    });
    steps.push({
      name: '知识库设置',
      run: () => http.put(`/agents/${agentId.value}`, {
        kbEnabled: form.kbEnabled ? 1 : 0,
        kbTopK: form.kbTopK,
      }) as unknown as Promise<void>,
    });
    steps.push({
      name: '知识库关联',
      run: () => http.post(`/admin/agents/${agentId.value}/knowledge-bases`, {
        kbIds: form.knowledgeBaseIds,
      }) as unknown as Promise<void>,
    });
  }

  savingAll.value = true;
  const results: Array<{ name: string; ok: boolean; message?: string }> = [];
  for (const step of steps) {
    try {
      await step.run();
      results.push({ name: step.name, ok: true });
    } catch (err: any) {
      results.push({ name: step.name, ok: false, message: err?.message || err?.message || '失败' });
    }
  }
  savingAll.value = false;

  const okCount = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    ElMessage.success(`已保存全部（${results.length} 项）`);
    if (!isNew.value) loadAgent();
  } else if (okCount === 0) {
    ElMessage.error(
      `保存全部失败：${failed.map((r) => `${r.name} ${r.message || ''}`).join('；')}`,
    );
  } else {
    ElMessage.warning(
      `部分保存成功（${okCount}/${results.length}），失败：${failed.map((r) => `${r.name} ${r.message || ''}`).join('；')}`,
    );
    if (!isNew.value) loadAgent();
  }
}

async function onSaveModels(): Promise<void> {
  try {
    await http.put(`/agents/${agentId.value}`, {
      primaryModelId: form.primaryModelId,
      fallbackModelIds: form.fallbackModelIds,
    });
    ElMessage.success('模型设置已保存');
    loadAgent();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  }
}

async function onSaveKb(): Promise<void> {
  if (!validateKb()) return;
  try {
    await http.put(`/agents/${agentId.value}`, {
      kbEnabled: form.kbEnabled ? 1 : 0,
      kbTopK: form.kbTopK,
    });
    ElMessage.success('知识库设置已保存');
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  }
}

function beforeUpload(file: any): boolean {
  const allowed = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!allowed.includes(ext)) {
    ElMessage.warning(`不支持 .${ext} 格式`);
    return false;
  }
  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('文件不能超过 50 MB');
    return false;
  }
  return true;
}

async function onUpload(options: any): Promise<void> {
  const { file, onSuccess, onError } = options;
  const form = new FormData();
  form.append('file', file);
  try {
    // 上传 FormData 时必须让浏览器/axios 自动生成 multipart boundary
    // 手动设置 Content-Type 会破坏 boundary 导致后端解析失败
    // 通过 axios 的 transformRequest 标记，不要让 http.ts 拦截器写入 JSON 头
    const res = await http.post(
      `/admin/agents/${agentId.value}/knowledge/upload`,
      form,
      {
        transformRequest: (data: any) => data,
        headers: { 'Content-Type': undefined },
      },
    );
    ElMessage.success(res.message || '上传成功');
    onSuccess(res);
    loadKbFiles();
  } catch (err: any) {
    ElMessage.error(err?.message || '上传失败');
    onError(err);
  }
}

async function onDeleteFile(row: any): Promise<void> {
  await ElMessageBox.confirm(`确认删除文件 "${row.filename}"？删除后该文件的知识块也会被清除。`, '确认删除', {
    type: 'warning',
  });
  try {
    await http.delete(`/admin/agents/${agentId.value}/knowledge/files/${row.id}`);
    ElMessage.success('已删除');
    loadKbFiles();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

async function onRunTest(): Promise<void> {
  if (!testInput.value.trim()) {
    ElMessage.warning('请输入测试问题');
    return;
  }
  running.value = true;
  testOutput.value = '';
  testMeta.modelUsed = undefined;
  testMeta.latencyMs = undefined;
  testMeta.tokensUsed = undefined;
  const startTime = Date.now();

  try {
    if (streamSwitch.value) {
      const url = `/agents/${agentId.value}/chat`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ message: testInput.value, stream: true }),
      });

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n').filter(Boolean);
          for (const line of lines) {
            const m = line.match(/^event: (\w+)\ndata: (.+)$/s);
            if (!m) continue;
            const [, eventName, dataStr] = m;
            try {
              const data = JSON.parse(dataStr);
              if (eventName === 'chunk') {
                testOutput.value += data.content || '';
              } else if (eventName === 'done') {
                testMeta.modelUsed = data.modelUsed;
                testMeta.tokensUsed = data.tokensUsed;
              } else if (eventName === 'error') {
                ElMessage.error(data.message);
              }
            } catch { /* ignore */ }
          }
        }
      }
      testMeta.latencyMs = Date.now() - startTime;
    } else {
      const res = await http.post(`/agents/${agentId.value}/chat`, {
        message: testInput.value,
      });
      testOutput.value = res.content;
      testMeta.modelUsed = res.modelUsed;
      testMeta.tokensUsed = res.tokensUsed;
      testMeta.latencyMs = Date.now() - startTime;
    }
    ElMessage.success('测试完成');
  } catch (err: any) {
    ElMessage.error(err?.message || '运行失败');
  } finally {
    running.value = false;
  }
}

onMounted(() => {
  loadAgent();
  loadModels();
  loadAllKbs();
  if (!isNew.value) {
    loadAgentKbBindings();
  }
});
</script>

<style scoped>
.agent-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-tabs {
  margin-top: 16px;
}

.detail-tabs :deep(.el-tabs__nav-wrap::after) { background: transparent; }
.detail-tabs :deep(.el-tabs__item) { color: var(--text-secondary); }
.detail-tabs :deep(.el-tabs__item.is-active) { color: var(--color-primary-light); }

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.kb-uploader {
  width: 100%;
}

.kb-uploader :deep(.el-upload) {
  width: 100%;
}

.kb-uploader :deep(.el-upload-dragger) {
  background: rgba(15, 19, 47, 0.4) !important;
  border: 1px dashed var(--border-medium) !important;
  padding: 32px;
}

.kb-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--color-primary) !important;
  background: rgba(94, 114, 228, 0.06) !important;
}

.upload-zone { text-align: center; }

.upload-icon {
  font-size: 36px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.upload-text {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.test-output {
  width: 100%;
  min-height: 240px;
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
  background: rgba(15, 19, 47, 0.6);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.run-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
