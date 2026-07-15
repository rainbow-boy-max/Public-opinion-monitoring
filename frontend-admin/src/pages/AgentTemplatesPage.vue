<template>
  <GlassCard title="AI 智能体模板市场" icon="robot" subtitle="从预置模板一键部署 AI 智能体">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="onAdd">添加模板</el-button>
    </template>

    <div class="category-tabs">
      <el-radio-group v-model="activeCategory" @change="loadTemplates">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button v-for="c in categories" :key="c" :label="c">{{ CATEGORY_LABEL[c] || c }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="template-grid">
      <article v-for="t in templates" :key="t.id" class="template-card">
        <div class="template-card__head">
          <div class="template-card__icon" :style="{ background: iconBg(t.icon) }">
            <span v-html="iconSvg(t.icon)" />
          </div>
          <div class="template-card__meta">
            <div class="template-card__name">{{ t.name }}</div>
            <el-tag size="small" effect="dark" :type="categoryType(t.category)">
              {{ CATEGORY_LABEL[t.category] || t.category }}
            </el-tag>
          </div>
        </div>
        <div class="template-card__desc">{{ t.description }}</div>
        <div v-if="t.capabilities" class="template-card__caps">
          <el-tag
            v-for="(v, k) in parsedCaps(t.capabilities)"
            :key="k"
            v-show="v"
            size="small"
            :type="capType(k)"
            effect="plain"
          >
            {{ capLabel(k) }}
          </el-tag>
        </div>
        <div class="template-card__footer">
          <el-button type="primary" size="small" @click="onDeploy(t)">立即部署</el-button>
          <el-button size="small" @click="onEdit(t)" style="margin-left: 8px;">编辑</el-button>
          <el-button
            size="small"
            :type="t.isActive ? 'warning' : 'success'"
            @click="onToggle(t)"
            style="margin-left: auto;"
          >
            {{ t.isActive ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="onDelete(t)">删除</el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="templates.length === 0" description="暂无模板" />
  </GlassCard>

  <el-dialog v-model="deployVisible" title="从模板部署智能体" width="520px">
    <el-form :model="deployForm" label-width="120px">
      <el-form-item label="模板名称">
        <el-input :model-value="deployingTemplate?.name" disabled />
      </el-form-item>
      <el-form-item label="智能体名称" prop="name">
        <el-input v-model="deployForm.name" placeholder="默认使用模板名称" />
      </el-form-item>
      <el-form-item label="主用模型" prop="primaryModelId">
        <el-select v-model="deployForm.primaryModelId" filterable placeholder="选择主用模型" style="width:100%">
          <el-option-group v-for="p in modelGroups" :key="p.provider" :label="p.label">
            <el-option
              v-for="m in p.models"
              :key="m.id"
              :label="`${m.displayName} (${m.model})`"
              :value="m.id"
            />
          </el-option-group>
        </el-select>
      </el-form-item>
      <el-form-item label="备用模型">
        <el-select v-model="deployForm.fallbackModelIds" multiple filterable placeholder="可选" style="width:100%">
          <el-option-group v-for="p in modelGroups" :key="p.provider" :label="p.label">
            <el-option
              v-for="m in p.models"
              :key="m.id"
              :label="`${m.displayName} (${m.model})`"
              :value="m.id"
            />
          </el-option-group>
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="deployVisible = false">取消</el-button>
      <el-button type="primary" :loading="deploying" @click="onConfirmDeploy">确认部署</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="editVisible" :title="editingId ? '编辑模板' : '添加模板'" width="640px">
    <el-form :model="editForm" label-width="120px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="editForm.name" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="editForm.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="分类" prop="category">
        <el-select v-model="editForm.category" style="width:100%">
          <el-option v-for="(lb, val) in CATEGORY_LABEL" :key="val" :label="lb" :value="val" />
        </el-select>
      </el-form-item>
      <el-form-item label="系统 Prompt">
        <el-input
          v-model="editForm.systemPrompt"
          type="textarea"
          :rows="8"
          style="font-family: 'JetBrains Mono', monospace; font-size: 13px;"
        />
      </el-form-item>
      <el-form-item label="能力 (JSON)">
        <el-input v-model="editForm.capabilities" placeholder='{"vision":false,"reasoning":true,"webSearch":false}' />
      </el-form-item>
      <el-form-item label="建议模型">
        <el-input v-model="editForm.suggestedModel" placeholder="可选" />
      </el-form-item>
      <el-form-item label="图标">
        <el-input v-model="editForm.icon" placeholder="shield / headset / edit / chart / search / share" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="editForm.sortOrder" :min="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onConfirmEdit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'AgentTemplatesPage' });
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const CATEGORY_LABEL: Record<string, string> = {
  pr: '舆情公关',
  service: '智能客服',
  writing: '内容创作',
  analysis: '数据分析',
  other: '其他',
};

function categoryType(cat: string): 'danger' | 'primary' | 'warning' | 'success' | 'info' {
  return ({ pr: 'danger', service: 'primary', writing: 'warning', analysis: 'success' } as any)[cat] || 'info';
}

function capLabel(k: string): string {
  return ({ vision: '图片理解', reasoning: '推理思考', webSearch: '联网搜索' } as any)[k] || k;
}

function capType(k: string): 'success' | 'warning' | 'primary' | 'info' {
  return ({ vision: 'success', reasoning: 'warning', webSearch: 'primary' } as any)[k] || 'info';
}

function parsedCaps(caps: string): Record<string, boolean> {
  try {
    return JSON.parse(caps);
  } catch {
    return {};
  }
}

function iconBg(icon: string): string {
  const m: Record<string, string> = {
    shield: 'linear-gradient(135deg, #EF4444, #DC2626)',
    headset: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    edit: 'linear-gradient(135deg, #F59E0B, #D97706)',
    chart: 'linear-gradient(135deg, #10B981, #059669)',
    search: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
    share: 'linear-gradient(135deg, #EC4899, #BE185D)',
  };
  return m[icon] || 'var(--gradient-primary)';
}

function iconSvg(icon: string): string {
  const icons: Record<string, string> = {
    shield: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    headset: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    chart: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    search: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    share: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    robot: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>',
  };
  return icons[icon] || icons.robot;
}

interface Template {
  id: number;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string;
  suggestedModel: string | null;
  icon: string;
  category: string;
  sortOrder: number;
  isActive: number;
}

const templates = ref<Template[]>([]);
const categories = ref<string[]>([]);
const activeCategory = ref('');
const allModels = ref<any[]>([]);

const modelGroups = computed(() => {
  const grouped: Record<string, { label: string; models: any[] }> = {};
  for (const m of allModels.value) {
    if (!m.apiKeyConfigured) continue;
    const key = m.provider;
    if (!grouped[key]) grouped[key] = { label: m.provider, models: [] };
    grouped[key].models.push(m);
  }
  return Object.values(grouped);
});

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI', deepseek: 'DeepSeek', dashscope: '阿里云百炼',
  zhipu: '智谱 AI', moonshot: '月之暗面 Kimi', siliconflow: '硅基流动', custom: '自定义',
};

for (const g of Object.values(modelGroups.value)) {
  g.label = PROVIDER_LABEL[g.label] || g.label;
}

async function loadTemplates(): Promise<void> {
  try {
    const params: any = {};
    if (activeCategory.value) params.category = activeCategory.value;
    templates.value = await http.get('/agent-templates', { params });
  } catch (err) {
    console.error(err);
  }
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await http.get('/agent-templates/categories');
  } catch (err) {
    console.error(err);
  }
}

async function loadModels(): Promise<void> {
  try {
    const r = await http.get('/admin/llm-models', { params: { page: 1, pageSize: 100 } });
    allModels.value = r.items;
  } catch (err) {
    console.error(err);
  }
}

// Deploy
const deployVisible = ref(false);
const deploying = ref(false);
const deployingTemplate = ref<Template | null>(null);
const deployForm = ref({
  name: '',
  primaryModelId: 0,
  fallbackModelIds: [] as number[],
});

function onDeploy(t: Template): void {
  deployingTemplate.value = t;
  deployForm.value = { name: '', primaryModelId: 0, fallbackModelIds: [] };
  deployVisible.value = true;
}

async function onConfirmDeploy(): Promise<void> {
  if (!deployForm.value.primaryModelId) {
    ElMessage.warning('请选择主用模型');
    return;
  }
  deploying.value = true;
  try {
    await http.post(`/agent-templates/${deployingTemplate.value!.id}/deploy`, {
      name: deployForm.value.name || undefined,
      primaryModelId: deployForm.value.primaryModelId,
      fallbackModelIds: deployForm.value.fallbackModelIds,
    });
    ElMessage.success('智能体部署成功，请前往智能体列表查看');
    deployVisible.value = false;
  } catch (err: any) {
    ElMessage.error(err?.message || '部署失败');
  } finally {
    deploying.value = false;
  }
}

// Edit / Add
const editVisible = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);
const editForm = ref({
  name: '',
  description: '',
  systemPrompt: '',
  capabilities: '{}',
  suggestedModel: '',
  icon: 'robot',
  category: 'other',
  sortOrder: 0,
});

function onAdd(): void {
  editingId.value = null;
  editForm.value = {
    name: '', description: '', systemPrompt: '',
    capabilities: '{}', suggestedModel: '', icon: 'robot', category: 'other', sortOrder: 0,
  };
  editVisible.value = true;
}

function onEdit(t: Template): void {
  editingId.value = t.id;
  editForm.value = {
    name: t.name,
    description: t.description,
    systemPrompt: t.systemPrompt,
    capabilities: t.capabilities,
    suggestedModel: t.suggestedModel || '',
    icon: t.icon,
    category: t.category,
    sortOrder: t.sortOrder,
  };
  editVisible.value = true;
}

async function onConfirmEdit(): Promise<void> {
  saving.value = true;
  try {
    if (editingId.value) {
      await http.put(`/agent-templates/${editingId.value}`, editForm.value);
      ElMessage.success('已更新');
    } else {
      await http.post('/agent-templates', editForm.value);
      ElMessage.success('已创建');
    }
    editVisible.value = false;
    loadTemplates();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onToggle(t: Template): Promise<void> {
  try {
    await http.patch(`/agent-templates/${t.id}/toggle`);
    ElMessage.success(t.isActive ? '已禁用' : '已启用');
    loadTemplates();
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败');
  }
}

async function onDelete(t: Template): Promise<void> {
  await ElMessageBox.confirm(`确认删除模板 "${t.name}"？`, '删除确认', { type: 'warning' });
  try {
    await http.delete(`/agent-templates/${t.id}`);
    ElMessage.success('已删除');
    loadTemplates();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

onMounted(() => {
  loadTemplates();
  loadCategories();
  loadModels();
});
</script>

<style scoped>
.category-tabs {
  margin-bottom: 20px;
}

.category-tabs :deep(.el-radio-button__inner) {
  background: var(--glass-bg);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}

.category-tabs :deep(.el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  background: var(--gradient-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.template-card {
  padding: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}

.template-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.4), 0 0 24px rgba(94, 114, 228, 0.2);
}

.template-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.template-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.template-card__meta {
  flex: 1;
  min-width: 0;
}

.template-card__name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.template-card__desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-card__caps {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.template-card__footer {
  display: flex;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}
</style>
