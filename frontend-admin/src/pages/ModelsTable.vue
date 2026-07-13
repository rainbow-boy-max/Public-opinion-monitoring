<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column prop="provider" label="提供商" width="110">
      <template #default="{ row }">
        <el-tag :type="providerColor(row.provider)" effect="dark" size="small">
          {{ row.provider }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="displayName" label="显示名">
      <template #default="{ row }">
        <strong>{{ row.displayName }}</strong>
      </template>
    </el-table-column>
    <el-table-column label="模型 ID">
      <template #default="{ row }">
        <code style="font-size: 12px; color: var(--text-secondary)">{{ row.model }}</code>
      </template>
    </el-table-column>
    <el-table-column label="API Key">
      <template #default="{ row }">
        <span v-if="row.apiKeyConfigured" class="api-key-ok">
          <span class="dot dot--ok" />已配置
          <span class="mask">{{ row.apiKeyMasked }}</span>
        </span>
        <span v-else class="api-key-missing">
          <span class="dot dot--missing" />未配置
        </span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="100">
      <template #default="{ row }">
        <el-switch
          :model-value="row.isEnabled"
          @change="(v: boolean) => onToggle(row, v)"
        />
      </template>
    </el-table-column>
    <el-table-column label="最近测试" width="140">
      <template #default="{ row }">
        <span v-if="row.lastTestedAt" :class="['test-status', row.lastTestStatus]">
          {{ row.lastTestStatus === 'success' ? '✓ 成功' : '✗ 失败' }}
        </span>
        <span v-else class="test-status test-none">未测试</span>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">
          {{ row.lastTestedAt ? new Date(row.lastTestedAt).toLocaleString('zh-CN') : '' }}
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="280" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click="$emit('test', row)">测试</el-button>
        <el-button size="small" @click="$emit('edit', row)">配置</el-button>
        <el-button
          v-if="!row.isPreset"
          size="small"
          type="danger"
          @click="$emit('delete', row)"
        >删除</el-button>
        <el-tag v-else size="small" type="info" effect="dark">预置</el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import http from '@/utils/http';
import { ElMessage } from 'element-plus';

defineProps<{ items: any[]; loading?: boolean }>();
const emit = defineEmits<{
  test: [row: any];
  edit: [row: any];
  delete: [row: any];
}>();

function providerColor(p: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    openai: 'primary',
    deepseek: 'success',
    dashscope: 'warning',
    zhipu: 'info',
    moonshot: 'danger',
    siliconflow: 'primary',
    custom: 'info',
  };
  return map[p] || 'info';
}

async function onToggle(row: any, v: boolean): Promise<void> {
  try {
    await http.put(`/admin/llm-models/${row.id}`, {
      provider: row.provider,
      model: row.model,
      displayName: row.displayName,
      baseUrl: row.baseUrl,
      maxTokens: row.maxTokens,
      isEnabled: v,
    });
    row.isEnabled = v;
    ElMessage.success(v ? '已启用' : '已禁用');
  } catch (err: any) {
    ElMessage.error(err?.message || '切换失败');
  }
}
void emit;
</script>

<style scoped>
.api-key-ok,
.api-key-missing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.api-key-ok { color: var(--color-success); }
.api-key-missing { color: var(--color-danger); }

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot--ok { background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }
.dot--missing { background: var(--color-danger); box-shadow: 0 0 6px var(--color-danger); }

.mask {
  margin-left: 4px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

.test-status {
  font-size: 12px;
  font-weight: 500;
}

.test-status.test-status.success,
.test-success { color: var(--color-success); }
.test-status.test-status.failed,
.test-failed { color: var(--color-danger); }
.test-status.test-status.none,
.test-none { color: var(--text-tertiary); }
</style>
