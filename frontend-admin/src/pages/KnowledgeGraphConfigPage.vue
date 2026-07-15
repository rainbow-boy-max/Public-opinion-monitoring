<template>
  <div class="kg-config-page">
    <PageHeader title="知识图谱模型配置" subtitle="选择知识图谱实体抽取使用的 LLM 模型">
      <template #actions>
        <el-button type="primary" size="small" :loading="saving" @click="saveConfig">保存配置</el-button>
      </template>
    </PageHeader>

    <div class="kg-config-content">
      <GlassCard title="主模型配置" subtitle="用于知识图谱实体抽取的主模型">
        <div class="config-form">
          <div class="form-item">
            <label class="form-label">主模型</label>
            <el-select v-model="selectedPrimary" placeholder="请选择主模型" style="width: 400px" filterable>
              <el-option
                v-for="m in models"
                :key="m.id"
                :label="`${m.displayName} (${m.provider})`"
                :value="m.id"
              />
            </el-select>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="备用模型配置" subtitle="当主模型不可用时自动切换（最多选 5 个）">
        <div class="config-form">
          <div class="form-item">
            <label class="form-label">备用模型</label>
            <el-select
              v-model="selectedFallback"
              multiple
              placeholder="请选择备用模型"
              style="width: 400px"
              filterable
              :max="5"
            >
              <el-option
                v-for="m in models"
                :key="m.id"
                :label="`${m.displayName} (${m.provider})`"
                :value="m.id"
                :disabled="m.id === selectedPrimary"
              />
            </el-select>
            <span class="form-hint">已选 {{ selectedFallback.length }}/5 个</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="当前配置状态">
        <el-table :data="configTableData" style="width: 100%" size="small">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="displayName" label="模型名称" min-width="180" />
          <el-table-column prop="provider" label="提供商" width="120" />
          <el-table-column label="角色" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.isPrimary" type="success" size="small">主模型</el-tag>
              <el-tag v-else-if="row.isFallback" type="info" size="small">备用</el-tag>
              <span v-else class="text-tertiary">-</span>
            </template>
          </el-table-column>
        </el-table>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import http from '@/utils/http';
import { ElMessage } from 'element-plus';
import PageHeader from '@shared/components/PageHeader.vue';
import GlassCard from '@shared/components/GlassCard.vue';

interface LlmModel {
  id: number;
  displayName: string;
  provider: string;
  model: string;
  isKgPrimary: boolean;
  isKgFallback: boolean;
}

const models = ref<LlmModel[]>([]);
const selectedPrimary = ref<number | null>(null);
const selectedFallback = ref<number[]>([]);
const saving = ref(false);

const configTableData = computed(() =>
  models.value.map(m => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    isPrimary: m.isKgPrimary,
    isFallback: m.isKgFallback,
  }))
);

async function loadModels(): Promise<void> {
  try {
    const data = await http.get('/admin/llm-models', { params: { pageSize: 100 } });
    models.value = (data.items || [])
      .filter((m: any) => m.isEnabled)
      .map((m: any) => ({
        id: m.id,
        displayName: m.displayName || m.name || m.model || '未知模型',
        provider: m.provider,
        model: m.model,
        isEnabled: m.isEnabled,
        isKgPrimary: m.isKgPrimary,
        isKgFallback: m.isKgFallback,
      }));
    const primary = models.value.find(m => m.isKgPrimary);
    if (primary) selectedPrimary.value = primary.id;
    selectedFallback.value = models.value.filter(m => m.isKgFallback).map(m => m.id);
  } catch {
    ElMessage.error('加载模型列表失败');
  }
}

async function saveConfig(): Promise<void> {
  if (!selectedPrimary.value) {
    ElMessage.warning('请选择主模型');
    return;
  }
  saving.value = true;
  try {
    await http.post('/admin/llm-models/kg-config', {
      primaryModelId: selectedPrimary.value,
      fallbackModelIds: selectedFallback.value,
    });
    ElMessage.success('配置已保存');
    await loadModels();
  } catch {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadModels();
});
</script>

<style scoped>
.kg-config-page {
  animation: fade-in 300ms ease-out;
}

.kg-config-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-form {
  padding: 8px 0;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.text-tertiary {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
