<template>
  <el-card>
    <template #header>
      <div class="header">
        <span>Webhook 机器人</span>
        <el-button type="primary" @click="openCreate">创建 Webhook</el-button>
      </div>
    </template>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
      支持企业微信、钉钉、飞书群机器人和自定义 JSON 模式。配置后，系统将实时推送舆情告警。
    </el-alert>
    <el-table :data="webhooks" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="format" label="格式" width="140">
        <template #default="{ row }">
          <el-tag>{{ formatLabel(row.format) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="url" label="URL" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastPushAt" label="最后推送" width="180">
        <template #default="{ row }">
          {{ row.lastPushAt ? new Date(row.lastPushAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="onTest(row)">测试</el-button>
          <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" title="创建 Webhook" width="600px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="URL" prop="url">
        <el-input v-model="form.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
      </el-form-item>
      <el-form-item label="格式" prop="format">
        <el-select v-model="form.format">
          <el-option label="企业微信" value="wecom" />
          <el-option label="钉钉" value="dingtalk" />
          <el-option label="飞书" value="feishu" />
          <el-option label="自定义 JSON" value="custom_json" />
        </el-select>
      </el-form-item>
      <el-form-item label="签名密钥">
        <el-input v-model="form.secretKey" placeholder="可选,用于 HMAC 签名" />
      </el-form-item>
      <el-form-item label="绑定任务">
        <el-select v-model="form.taskIds" multiple placeholder="选择要绑定的监控任务">
          <el-option
            v-for="t in tasks"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="命中推送">
        <el-switch v-model="form.pushOnMatch" />
        <span style="margin-left: 12px">关键词命中立即推送</span>
      </el-form-item>
      <el-form-item label="定时推送">
        <el-switch v-model="form.pushPeriodic" />
      </el-form-item>
      <el-form-item v-if="form.pushPeriodic" label="推送频率">
        <el-select v-model="form.periodicFreq">
          <el-option label="每小时" value="hourly" />
          <el-option label="每 6 小时" value="every_6h" />
          <el-option label="每天" value="daily" />
        </el-select>
      </el-form-item>
      <el-form-item label="短信告警">
        <el-switch v-model="form.smsAlertEnabled" />
        <span style="margin-left: 12px">紧急舆情触发短信通知</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import http from '@/utils/http';

interface WebhookRow {
  id: number;
  name: string;
  url: string;
  format: string;
  status: string;
  lastPushAt: string | null;
}

interface Task {
  id: number;
  name: string;
}

const webhooks = ref<WebhookRow[]>([]);
const tasks = ref<Task[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const creating = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  url: '',
  format: 'dingtalk',
  secretKey: '',
  taskIds: [] as number[],
  pushOnMatch: true,
  pushPeriodic: false,
  periodicFreq: 'daily',
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

function statusLabel(s: string): string {
  return ({ active: '正常', error: '异常', disabled: '已禁用' } as Record<string, string>)[s] || s;
}

function statusTag(s: string): 'success' | 'danger' | 'info' {
  return ({ active: 'success', error: 'danger', disabled: 'info' } as any)[s] || 'info';
}

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
  await ElMessageBox.confirm(`确认删除 Webhook "${row.name}"?`);
  await http.delete(`/webhooks/${row.id}`);
  ElMessage.success('已删除');
  load();
}

onMounted(load);
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
