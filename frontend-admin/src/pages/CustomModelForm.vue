<template>
  <div class="custom-form-card">
    <h3 style="margin-top: 0; color: var(--text-primary)">自定义 LLM 模型（OpenAI 兼容协议）</h3>
    <p style="font-size: 13px; color: var(--text-tertiary); margin-bottom: 16px">
      任何兼容 OpenAI /v1/chat/completions 协议的 API 服务均可使用（如 OneAPI、Together AI、SiliconFlow 等）
    </p>

    <div v-if="saved" class="saved-banner">
      ✅ 模型已添加：<strong>{{ saved }}</strong>
      <el-button size="small" @click="saved = ''">关闭</el-button>
    </div>

    <el-form :inline="false" label-width="140px">
      <el-form-item label="Base URL">
        <el-input v-model="baseUrl" placeholder="https://api.your-provider.com/v1" />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input v-model="apiKey" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="fetching" @click="onFetch">一键获取模型列表</el-button>
      </el-form-item>

      <div v-if="availableModels.length > 0" class="model-list">
        <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 12px">
          发现 <strong>{{ availableModels.length }}</strong> 个模型，点击添加到自定义列表：
        </p>
        <div class="model-chips">
          <el-tag
            v-for="m in availableModels"
            :key="m"
            :type="modelsToAdd.includes(m) ? 'success' : 'info'"
            effect="dark"
            class="model-chip"
            @click="toggleAdd(m)"
          >
            {{ m }}
            <el-icon style="margin-left: 4px">
              <Plus v-if="!modelsToAdd.includes(m)" />
              <Check v-else />
            </el-icon>
          </el-tag>
        </div>
        <el-button
          v-if="modelsToAdd.length > 0"
          type="success"
          style="margin-top: 16px"
          :loading="saving"
          @click="onAddMultiple"
        >
          添加 {{ modelsToAdd.length }} 个模型到自定义列表
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Check } from '@element-plus/icons-vue';
import http from '@/utils/http';

const emit = defineEmits<{ saved: [] }>();

const baseUrl = ref('');
const apiKey = ref('');
const fetching = ref(false);
const availableModels = ref<string[]>([]);
const modelsToAdd = ref<string[]>([]);
const saving = ref(false);
const saved = ref('');

async function onFetch(): Promise<void> {
  if (!baseUrl.value || !apiKey.value) {
    ElMessage.warning('请填写 Base URL 和 API Key');
    return;
  }
  fetching.value = true;
  try {
    const res = await http.post('/admin/llm-models/fetch-models', {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
    });
    availableModels.value = res.models;
    modelsToAdd.value = [];
    ElMessage.success(`找到 ${res.count} 个模型`);
  } catch (err: any) {
    ElMessage.error(err?.message || '获取失败');
  } finally {
    fetching.value = false;
  }
}

function toggleAdd(m: string): void {
  const idx = modelsToAdd.value.indexOf(m);
  if (idx >= 0) modelsToAdd.value.splice(idx, 1);
  else modelsToAdd.value.push(m);
}

async function onAddMultiple(): Promise<void> {
  if (modelsToAdd.value.length === 0) return;
  saving.value = true;
  let okCount = 0;
  try {
    for (const m of modelsToAdd.value) {
      try {
        await http.post('/admin/llm-models', {
          provider: 'custom',
          model: m,
          displayName: m,
          baseUrl: baseUrl.value,
          apiKey: apiKey.value,
          maxTokens: 4096,
          isEnabled: true,
        });
        okCount++;
      } catch (err) {
        // skip dup
      }
    }
    saved.value = `${okCount} 个模型`;
    modelsToAdd.value = [];
    availableModels.value = [];
    ElMessage.success('已添加 ' + okCount + ' 个模型');
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.custom-form-card {
  padding: 24px;
  background: rgba(15, 19, 47, 0.4);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-medium);
}

.saved-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-sm);
  color: var(--color-success);
  margin-bottom: 16px;
}

.model-list {
  margin-top: 20px;
}

.model-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.model-chip {
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 6px 12px;
}
</style>
