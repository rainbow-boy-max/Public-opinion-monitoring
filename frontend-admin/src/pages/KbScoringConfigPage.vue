<template>
  <GlassCard title="AI 打分配置" icon="⭐" subtitle="知识库文档上传后 AI 自动打分的模型与能力配置">
    <template #extra>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>

    <el-form :model="form" label-width="180px" style="max-width: 720px">
      <el-form-item label="启用 AI 打分">
        <el-switch v-model="form.enabled" />
        <span style="margin-left: 12px">关闭后新上传文档不再执行 AI 打分</span>
      </el-form-item>

      <el-form-item v-if="form.enabled" label="主用打分模型">
        <el-select v-model="form.primaryModelId" filterable style="width: 100%" placeholder="选择模型（必选）">
          <el-option-group
            v-for="g in groupedModels"
            :key="g.provider"
            :label="g.provider"
          >
            <el-option
              v-for="m in g.models"
              :key="m.id"
              :value="m.id"
              :label="`${m.displayName} (${m.model})`"
            >
              <span style="float: left">{{ m.displayName }}</span>
              <span
                v-if="m.capabilities && (m.capabilities.vision || m.capabilities.reasoning || m.capabilities.webSearch)"
                style="float: right; margin-left: 8px"
              >
                <el-tag v-if="m.capabilities.vision" type="success" size="small">📷 vision</el-tag>
                <el-tag v-if="m.capabilities.reasoning" type="warning" size="small">🧠 reasoning</el-tag>
              </span>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.enabled" label="备用模型（最多 5 个）">
        <el-select v-model="form.fallbackModelIds" multiple filterable style="width: 100%" placeholder="可选多个备用模型">
          <el-option
            v-for="m in allModels"
            :key="m.id"
            :value="m.id"
            :label="`${m.displayName} (${m.model}) [${m.provider}]`"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="联网搜索增强评分">
        <el-switch v-model="form.enableWebSearch" />
        <span style="margin-left: 12px; color: var(--text-tertiary)">
          给评分 prompt 注入外部网络搜索信息，辅助判断文档真实性
        </span>
      </el-form-item>

      <el-form-item label="图片理解增强">
        <el-switch v-model="form.enableVision" />
        <span style="margin-left: 12px; color: var(--text-tertiary)">
          若模型支持 vision 能力，自动提取文档中的图片描述辅助评分（仅对主用模型 vision=true 时启用）
        </span>
      </el-form-item>
    </el-form>
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

defineOptions({ name: 'KbScoringConfigPage' });

interface LlmModel {
  id: number;
  provider: string;
  model: string;
  displayName: string;
  isEnabled: boolean;
  capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean };
}

interface ConfigResp {
  primaryModelId: number;
  fallbackModelIds: number[];
  enableWebSearch: boolean;
  enableVision: boolean;
  models: LlmModel[];
  updatedAt: string | null;
}

const allModels = ref<LlmModel[]>([]);
const saving = ref(false);

const form = reactive({
  enabled: false,
  primaryModelId: 0,
  fallbackModelIds: [] as number[],
  enableWebSearch: false,
  enableVision: false,
});

const groupedModels = computed(() => {
  const g: Record<string, LlmModel[]> = {};
  for (const m of allModels.value) {
    if (!m.isEnabled) continue;
    if (!g[m.provider]) g[m.provider] = [];
    g[m.provider].push(m);
  }
  return Object.entries(g).map(([provider, models]) => ({ provider, models }));
});

async function loadConfig(): Promise<void> {
  try {
    const r = (await http.get('/admin/kb-scoring/config')) as ConfigResp;
    allModels.value = r.models || [];
    form.primaryModelId = r.primaryModelId;
    form.fallbackModelIds = r.fallbackModelIds || [];
    form.enableWebSearch = r.enableWebSearch;
    form.enableVision = r.enableVision;
    form.enabled = r.primaryModelId > 0;
  } catch (err) {
    console.error(err);
  }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      primaryModelId: form.enabled ? form.primaryModelId : 0,
      fallbackModelIds: form.fallbackModelIds,
      enableWebSearch: form.enableWebSearch,
      enableVision: form.enableVision,
    };
    await http.put('/admin/kb-scoring/config', payload);
    ElMessage.success('已保存');
    await loadConfig();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadConfig);
</script>
