<template>
  <el-table
    :data="items"
    v-loading="loading"
    :row-key="(row: any) => row.id"
    stripe
    border
    style="width: 100%"
    @selection-change="onSelectionChange"
  >
    <el-table-column type="selection" width="48" :selectable="row => row.provider !== 'custom' || row.apiKeyConfigured" />

    <el-table-column prop="provider" label="提供商" width="150">
      <template #default="{ row }">
        <el-tag :type="providerColor(row.provider)" effect="dark" size="small">
          {{ row.provider }}
        </el-tag>
        <span style="margin-left: 4px; font-size: 11px; color: var(--text-tertiary)">
          <el-tag v-if="row.apiStyle === 'anthropic'" type="warning" size="small" effect="plain">A</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">O</el-tag>
        </span>
      </template>
    </el-table-column>

    <el-table-column prop="displayName" label="显示名" min-width="160">
      <template #default="{ row }">
        <strong>{{ row.displayName }}</strong>
        <el-tag
          v-if="row.isPreset"
          type="info"
          size="small"
          effect="plain"
          style="margin-left: 6px"
        >预置</el-tag>
        <el-tag
          v-else
          type="warning"
          size="small"
          effect="plain"
          style="margin-left: 6px"
        >自定义</el-tag>
      </template>
    </el-table-column>

    <el-table-column label="模型 ID" min-width="200">
      <template #default="{ row }">
        <code style="font-size: 12px; color: var(--text-secondary)">{{ row.model }}</code>
      </template>
    </el-table-column>

    <el-table-column label="API Key" min-width="170">
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

    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tooltip
          :content="stateTooltip(row)"
          placement="top"
        >
          <el-tag :type="stateType(row)" effect="dark" size="small">
            {{ stateLabel(row) }}
          </el-tag>
        </el-tooltip>
      </template>
    </el-table-column>

    <el-table-column label="能力" width="200">
      <template #default="{ row }">
        <el-tag
          v-if="row.capabilities && row.capabilities.vision"
          type="success"
          size="small"
          effect="plain"
        >📷 vision</el-tag>
        <el-tag
          v-if="row.capabilities && row.capabilities.reasoning"
          type="warning"
          size="small"
          effect="plain"
        >🧠 reasoning</el-tag>
        <el-tag
          v-if="row.capabilities && row.capabilities.webSearch"
          type="primary"
          size="small"
          effect="plain"
        >🔍 webSearch</el-tag>
        <span
          v-if="!row.capabilities || (!row.capabilities.vision && !row.capabilities.reasoning && !row.capabilities.webSearch)"
          style="color: var(--text-tertiary); font-size: 12px"
        >无</span>
      </template>
    </el-table-column>

    <el-table-column label="排序" width="118" fixed="right">
      <template #default="{ row }">
        <el-button-group size="small">
          <el-button :disabled="!canMoveUp(row)" @click="$emit('moveUp', row)">↑</el-button>
          <el-button :disabled="!canMoveDown(row)" @click="$emit('moveDown', row)">↓</el-button>
        </el-button-group>
      </template>
    </el-table-column>

    <el-table-column label="操作" width="180" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click="$emit('test', row)">测试</el-button>
        <el-button size="small" @click="$emit('edit', row)">配置</el-button>
        <el-button
          size="small"
          type="danger"
          @click="$emit('delete', row)"
        >删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { ElTag, ElTooltip } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';

defineProps<{
  items: any[];
  loading?: boolean;
  totalList?: any[]; // 同一完整列表用于上下移动的边界判断
}>();

const emit = defineEmits<{
  test: [row: any];
  edit: [row: any];
  delete: [row: any];
  moveUp: [row: any];
  moveDown: [row: any];
  selectionChange: [rows: any[]];
}>();

function onSelectionChange(rows: any[]): void {
  emit('selectionChange', rows);
}

function providerColor(p: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    openai: 'primary',
    deepseek: 'success',
    deepseek_anthropic: 'success',
    dashscope: 'warning',
    zhipu: 'info',
    moonshot: 'danger',
    siliconflow: 'primary',
    minimax: 'success',
    minimax_anthropic: 'success',
    custom: 'info',
  };
  return map[p] || 'info';
}

function stateLabel(row: any): string {
  switch (row.effectiveState) {
    case 'enabled':
      return '已启用';
    case 'disabled':
      return '已禁用';
    case 'disabled_pending_key':
      return '待 Key';
    case 'enabled_force':
      return '异常启用';
    default:
      return '未知';
  }
}

function stateType(row: any): 'success' | 'info' | 'warning' | 'danger' {
  switch (row.effectiveState) {
    case 'enabled':
      return 'success';
    case 'disabled':
      return 'info';
    case 'disabled_pending_key':
      return 'warning';
    case 'enabled_force':
      return 'danger';
    default:
      return 'info';
  }
}

function stateTooltip(row: any): string {
  if (row.effectiveState === 'disabled_pending_key') {
    return '未配置 API Key，配置后自动启用';
  }
  if (row.effectiveState === 'enabled_force') {
    return '异常：isEnabled=1 但无 API Key，请编辑并填 Key';
  }
  return row.effectiveState;
}

function canMoveUp(row: any): boolean {
  const props = (defineProps as any) || {};
  const list = (props as any).totalList || [];
  if (list.length === 0) return false;
  const idx = list.findIndex((x: any) => x.id === row.id);
  return idx > 0;
}

function canMoveDown(row: any): boolean {
  const props = (defineProps as any) || {};
  const list = (props as any).totalList || [];
  if (list.length === 0) return false;
  const idx = list.findIndex((x: any) => x.id === row.id);
  return idx >= 0 && idx < list.length - 1;
}

void ArrowDown;
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
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 11px;
}
</style>
