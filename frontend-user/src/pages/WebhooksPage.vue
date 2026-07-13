<template>
  <GlassCard title="Webhook 机器人" icon="🔔" subtitle="实时推送告警到企业微信/钉钉/飞书/自定义">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="openCreate">创建 Webhook</el-button>
    </template>

    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 20px">
      <template #title>支持 4 种格式</template>
      企业微信 markdown、钉钉 actionCard、飞书 interactive、自定义 JSON。可选 HMAC 签名、自动重试、定时推送、短信告警。
    </el-alert>

    <div class="format-tabs">
      <span
        v-for="fmt in formatList"
        :key="fmt.value"
        class="format-tab"
        :class="{ 'format-tab--active': filterFormat === fmt.value }"
        @click="filterFormat = fmt.value"
      >
        <span class="format-tab__dot" :style="{ background: fmt.color }" />
        {{ fmt.label }}
        <span class="format-tab__count">{{ countByFormat(fmt.value) }}</span>
      </span>
    </div>

    <div class="webhook-grid">
      <article
        v-for="row in filteredWebhooks"
        :key="row.id"
        class="webhook-card"
      >
        <div class="webhook-card__head">
          <div class="webhook-card__icon" :style="{ background: formatColor(row.format) }">
            {{ formatIcon(row.format) }}
          </div>
          <div class="webhook-card__meta">
            <div class="webhook-card__name">{{ row.name }}</div>
            <div class="webhook-card__format">{{ formatLabel(row.format) }}</div>
          </div>
          <el-tag :type="statusTagType(row.status)" effect="dark" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </div>
        <div class="webhook-card__url">{{ row.url }}</div>
        <div class="webhook-card__footer">
          <span class="webhook-card__time">
            最后推送 {{ row.lastPushAt ? formatDate(row.lastPushAt) : '—' }}
          </span>
          <div class="webhook-card__actions">
            <el-button size="small" @click="onTest(row)">测试</el-button>
            <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
          </div>
        </div>
      </article>
    </div>

    <el-empty v-if="!loading && filteredWebhooks.length === 0" description="暂无 Webhook 机器人" />
  </GlassCard>

  <el-dialog v-model="dialogVisible" title="创建 Webhook 机器人" width="700">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="140px">
      <el-form-item label="机器人名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：AI 舆情告警" />
      </el-form-item>
      <el-form-item label="回调 URL" prop="url">
        <el-input v-model="form.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
      </el-form-item>
      <el-form-item label="推送格式" prop="format">
        <el-radio-group v-model="form.format">
          <el-radio-button label="wecom">企业微信</el-radio-button>
          <el-radio-button label="dingtalk">钉钉</el-radio-button>
          <el-radio-button label="feishu">飞书</el-radio-button>
          <el-radio-button label="custom_json">自定义 JSON</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="绑定监控任务">
        <el-select v-model="form.taskIds" multiple placeholder="选择要绑定的监控任务" style="width: 100%">
          <el-option
            v-for="t in tasks"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="签名密钥">
        <el-input v-model="form.secretKey" placeholder="可选,用于 HMAC 签名验证" />
      </el-form-item>
      <el-form-item>
        <el-switch v-model="form.pushOnMatch" />
        <span style="margin-left: 10px">命中立即推送</span>
      </el-form-item>
      <el-form-item>
        <el-switch v-model="form.pushPeriodic" />
        <span style="margin-left: 10px">启用定时推送</span>
      </el-form-item>
      <el-form-item v-if="form.pushPeriodic" label="推送频率">
        <el-radio-group v-model="form.periodicFreq">
          <el-radio-button label="hourly">每小时</el-radio-button>
          <el-radio-button label="every_6h">每 6 小时</el-radio-button>
          <el-radio-button label="daily">每天</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <el-switch v-model="form.smsAlertEnabled" />
        <span style="margin-left: 10px">紧急舆情触发短信通知</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface WebhookRow {
  id: number;
  name: string;
  url: string;
  format: string;
  status: string;
  lastPushAt: string | null;
}

interface Task { id: number; name: string; }

const webhooks = ref<WebhookRow[]>([]);
const tasks = ref<Task[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const creating = ref(false);
const formRef = ref<FormInstance>();
const filterFormat = ref('all');

const formatList = [
  { value: 'all', label: '全部', color: '#9DA8E5' },
  { value: 'wecom', label: '企业微信', color: '#10B981' },
  { value: 'dingtalk', label: '钉钉', color: '#3B82F6' },
  { value: 'feishu', label: '飞书', color: '#A78BFA' },
  { value: 'custom_json', label: '自定义', color: '#F59E0B' },
];

const form = reactive({
  name: '',
  url: '',
  format: 'dingtalk' as 'wecom' | 'dingtalk' | 'feishu' | 'custom_json',
  secretKey: '',
  taskIds: [] as number[],
  pushOnMatch: true,
  pushPeriodic: false,
  periodicFreq: 'daily' as 'hourly' | 'every_6h' | 'daily',
  smsAlertEnabled: false,
});

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  url: [{ required: true, message: '请输入 URL', trigger: 'blur' }],
  format: [{ required: true, message: '请选择格式', trigger: 'change' }],
};

function formatLabel(f: string): string {
  return ({ wecom: '企业微信', dingtalk: '钉钉', feishu: '飞书', custom_json: '自定义 JSON' } as Record<string, string>)[f] || f;
}

function formatIcon(f: string): string {
  return ({ wecom: '💬', dingtalk: '📢', feishu: '🚀', custom_json: '⚙️' } as Record<string, string>)[f] || '📨';
}

function formatColor(f: string): string {
  return ({ wecom: 'linear-gradient(135deg, #10B981, #059669)', dingtalk: 'linear-gradient(135deg, #3B82F6, #2563EB)', feishu: 'linear-gradient(135deg, #A78BFA, #7C3AED)', custom_json: 'linear-gradient(135deg, #F59E0B, #EF4444)' } as Record<string, string>)[f] || 'var(--gradient-primary)';
}

function statusLabel(s: string): string {
  return ({ active: '运行中', error: '异常', disabled: '已禁用' } as Record<string, string>)[s] || s;
}

function statusTagType(s: string): 'success' | 'danger' | 'info' {
  return ({ active: 'success', error: 'danger', disabled: 'info' } as any)[s] || 'info';
}

function formatDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function countByFormat(fmt: string): number {
  if (fmt === 'all') return webhooks.value.length;
  return webhooks.value.filter((w) => w.format === fmt).length;
}

const filteredWebhooks = computed(() => {
  if (filterFormat.value === 'all') return webhooks.value;
  return webhooks.value.filter((w) => w.format === filterFormat.value);
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    webhooks.value = await http.get('/webhooks');
    tasks.value = await http.get('/monitor-tasks');
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  Object.assign(form, {
    name: '',
    url: '',
    format: 'dingtalk',
    secretKey: '',
    taskIds: [],
    pushOnMatch: true,
    pushPeriodic: false,
    periodicFreq: 'daily',
    smsAlertEnabled: false,
  });
  dialogVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    creating.value = true;
    try {
      await http.post('/webhooks', form);
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      load();
    } catch (err: any) {
      ElMessage.error(err?.message || '创建失败');
    } finally {
      creating.value = false;
    }
  });
}

async function onTest(row: WebhookRow): Promise<void> {
  try {
    const res = await http.post(`/webhooks/${row.id}/test`);
    ElMessage.success(res?.message || '测试成功');
  } catch (err: any) {
    ElMessage.error(err?.message || '测试失败');
  }
}

async function onDelete(row: WebhookRow): Promise<void> {
  await ElMessageBox.confirm(`确认删除 Webhook "${row.name}"?`, '操作确认', {
    type: 'warning',
  });
  await http.delete(`/webhooks/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.format-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.format-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.format-tab:hover {
  border-color: var(--color-primary);
}

.format-tab--active {
  background: var(--gradient-primary) !important;
  color: #fff !important;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(94, 114, 228, 0.3);
}

.format-tab__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.format-tab__count {
  background: rgba(255, 255, 255, 0.15);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
}

.webhook-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.webhook-card {
  padding: 16px 18px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.webhook-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.4), 0 0 24px rgba(94, 114, 228, 0.2);
}

.webhook-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.webhook-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.webhook-card__meta {
  flex: 1;
  min-width: 0;
}

.webhook-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.webhook-card__format {
  font-size: 11px;
  color: var(--text-tertiary);
}

.webhook-card__url {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.webhook-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.webhook-card__time {
  flex: 1;
  min-width: 0;
}

.webhook-card__actions {
  display: flex;
  gap: 4px;
}
</style>
