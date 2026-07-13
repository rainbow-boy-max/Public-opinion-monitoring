<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="场景" width="110">
      <template #default="{ row }">
        <el-tag :type="getSceneType(row.scene)" effect="dark" size="small">
          {{ getSceneLabel(row.scene) }}
        </el-tag>
        <el-tag v-if="row.isDefault === 1" type="warning" size="small" effect="dark" style="margin-left: 4px">
          默认
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="名称" width="160" />
    <el-table-column prop="signName" label="签名" width="100">
      <template #default="{ row }">
        <code class="sign-code">{{ row.signName }}</code>
      </template>
    </el-table-column>
    <el-table-column label="模板内容" min-width="280" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="content-text">{{ row.templateContent }}</span>
      </template>
    </el-table-column>
    <el-table-column label="变量" width="120">
      <template #default="{ row }">
        <el-tag
          v-for="v in row.variables || []"
          :key="v"
          type="primary"
          effect="dark"
          size="small"
          style="margin-right: 2px"
        >
          {{ '${' + v + '}' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="阿里云 CODE" width="170">
      <template #default="{ row }">
        <code v-if="row.templateCode" class="code-text">{{ row.templateCode }}</code>
        <span v-else class="empty-text">—</span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="getStatusType(row.status)" size="small" effect="dark">
          {{ getStatusLabel(row.status) }}
        </el-tag>
        <el-tooltip v-if="row.rejectReason" :content="row.rejectReason" placement="top">
          <el-icon style="margin-left: 4px; color: var(--color-danger)"><Warning /></el-icon>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="380" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click="$emit('edit', row)">编辑</el-button>
        <el-button
          v-if="row.status === 'draft' || row.status === 'rejected'"
          size="small"
          type="success"
          @click="$emit('submit', row)"
        >
          一键报备
        </el-button>
        <el-button
          v-if="row.status === 'pending_review' && row.templateCode"
          size="small"
          type="warning"
          @click="$emit('sync', row)"
        >
          同步状态
        </el-button>
        <el-button
          v-if="!row.isDefault && row.status === 'approved'"
          size="small"
          @click="$emit('set-default', row)"
        >
          设为默认
        </el-button>
        <el-button size="small" @click="$emit('test', row)">测试</el-button>
        <el-button
          v-if="!row.isDefault"
          size="small"
          type="danger"
          @click="$emit('delete', row)"
        >
          删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>
  <el-empty v-if="!loading && items.length === 0" description="该场景暂无模板，可点击下方'新建模板'或使用一键初始化" />
</template>

<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue';

defineProps<{
  items: any[];
  loading?: boolean;
}>();

defineEmits<{
  edit: [row: any];
  submit: [row: any];
  sync: [row: any];
  test: [row: any];
  delete: [row: any];
  'set-default': [row: any];
}>();

function getSceneType(scene: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    login: 'primary',
    register: 'primary',
    reset_password: 'warning',
    opinion_alert: 'danger',
    ban_notify: 'danger',
    unban_notify: 'success',
    generic: 'info',
  };
  return map[scene] || 'info';
}

function getSceneLabel(scene: string): string {
  const map: Record<string, string> = {
    login: '登录',
    register: '注册',
    reset_password: '改密',
    opinion_alert: '预警',
    ban_notify: '封禁',
    unban_notify: '解封',
    generic: '通用',
  };
  return map[scene] || scene;
}

function getStatusLabel(s: string): string {
  return ({ draft: '草稿', pending_review: '审核中', approved: '已通过', rejected: '已驳回', disabled: '已禁用' } as Record<string, string>)[s] || s;
}

function getStatusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ draft: 'info', pending_review: 'warning', approved: 'success', rejected: 'danger', disabled: 'info' } as any)[s] || 'info';
}
</script>

<style scoped>
.sign-code,
.code-text {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--color-primary-light);
}

.code-text {
  font-size: 11px;
  word-break: break-all;
}

.content-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.empty-text {
  color: var(--text-tertiary);
  font-size: 12px;
}
</style>
