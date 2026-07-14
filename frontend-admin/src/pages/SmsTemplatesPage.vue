<template>
  <GlassCard title="短信模板管理" icon="📨" subtitle="登录/注册/改密/预警等 7 大场景模板 · 一键报备到阿里云">
    <template #extra>
      <el-button type="success" :icon="MagicStick" @click="onInitDefaults" :loading="initializing">
        一键初始化默认模板
      </el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建模板</el-button>
      <el-button :icon="Refresh" @click="loadData">刷新</el-button>
    </template>

    <el-tabs v-model="activeScene" class="scene-tabs">
      <el-tab-pane label="全部" name="">
        <TemplateTable :items="allItems" @test="onTest" @submit="onSubmit" @sync="onSync" @edit="openEditDialog" @delete="onDelete" @set-default="onSetDefault" />
      </el-tab-pane>
      <el-tab-pane
        v-for="s in SCENES"
        :key="s.value"
        :label="`${s.label} (${countByScene(s.value)})`"
        :name="s.value"
      >
        <TemplateTable
          :items="allItems.filter((t) => t.scene === s.value)"
          @test="onTest"
          @submit="onSubmit"
          @sync="onSync"
          @edit="openEditDialog"
          @delete="onDelete"
          @set-default="onSetDefault"
        />
      </el-tab-pane>
    </el-tabs>
  </GlassCard>

  <!-- 创建/编辑对话框 -->
  <el-dialog v-model="dialogVisible" :title="editing?.id ? '编辑模板' : '新建模板'" width="720">
    <el-form ref="formRef" :model="editing" :rules="rules" label-width="100px">
      <el-form-item label="场景" prop="scene">
        <el-select v-model="editing.scene" :disabled="!!editing.id" style="width: 100%">
          <el-option v-for="s in SCENES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="editing.name" placeholder="如：登录验证码模板" />
      </el-form-item>
      <el-form-item label="签名" prop="signName">
        <el-input v-model="editing.signName" placeholder="如：舆情监测" />
        <div class="form-tip">需在阿里云短信控制台申请并通过审核</div>
      </el-form-item>
      <el-form-item label="模板内容" prop="templateContent">
        <el-input v-model="editing.templateContent" type="textarea" :rows="6" placeholder="使用 ${code} 等占位符模板变量" style="font-family: 'JetBrains Mono', monospace;" />
      </el-form-item>
      <el-form-item label="设为默认">
        <el-switch v-model="editing.setDefault" />
        <span style="margin-left: 8px; font-size: 12px; color: var(--text-tertiary)">
          默认模板每个场景唯一
        </span>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="editing.remark" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item v-if="extractedVariables.length > 0" label="检测变量">
        <el-tag
          v-for="v in extractedVariables"
          :key="v"
          type="primary"
          effect="dark"
          size="small"
          style="margin-right: 4px"
        >
          ${<!-- -->{<!-- -->v<!-- -->}}
        </el-tag>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>

  <!-- 提交报备确认 -->
  <el-dialog v-model="submitVisible" title="一键报备到阿里云" width="520">
    <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
      <template #title>注意事项</template>
      <p>提交后阿里云审核时间约 2-4 小时；</p>
      <p>提交到阿里云后，模板代码 (templateCode) 会自动填入；</p>
      <p>审核状态可点击"同步状态"按钮获取最新结果。</p>
    </el-alert>
    <p>模板：<strong>{{ submittingItem?.name }}</strong></p>
    <p>当前状态：<el-tag :type="statusTagType(submittingItem?.status)" size="small">{{ statusLabel(submittingItem?.status) }}</el-tag></p>
    <template #footer>
      <el-button @click="submitVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onConfirmSubmit">确认提交阿里云</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'SmsTemplatesPage' });
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus, Refresh, MagicStick } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import TemplateTable from './SmsTemplateTable.vue';

interface Template {
  id: number;
  scene: string;
  name: string;
  signName: string;
  templateCode: string | null;
  templateContent: string;
  variables: string[];
  isDefault: number;
  status: string;
  rejectReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const SCENES = [
  { value: 'login', label: '登录验证码' },
  { value: 'register', label: '注册验证码' },
  { value: 'reset_password', label: '改密验证码' },
  { value: 'opinion_alert', label: '舆情预警' },
  { value: 'ban_notify', label: '封禁通知' },
  { value: 'unban_notify', label: '解封通知' },
  { value: 'generic', label: '通用通知' },
];

const allItems = ref<Template[]>([]);
const activeScene = ref('');

const dialogVisible = ref(false);
const editing = reactive<any>({
  id: 0,
  scene: 'login',
  name: '',
  signName: '舆情监测',
  templateContent: '',
  remark: '',
  setDefault: true,
});
const saving = ref(false);
const formRef = ref<FormInstance>();

const rules = {
  scene: [{ required: true, message: '请选择场景', trigger: 'change' }],
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  signName: [{ required: true, message: '请输入签名', trigger: 'blur' }],
  templateContent: [{ required: true, message: '请输入模板内容', trigger: 'blur' }],
};

const initializing = ref(false);

const submitVisible = ref(false);
const submitting = ref(false);
const submittingItem = ref<Template | null>(null);

const extractedVariables = computed(() => {
  const re = /\$\{([^}]+)\}/g;
  const set = new Set<string>();
  if (editing.templateContent) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(editing.templateContent))) set.add(m[1].trim());
  }
  return Array.from(set);
});

function statusLabel(s?: string): string {
  return ({ draft: '草稿', pending_review: '审核中', approved: '已通过', rejected: '已驳回', disabled: '已禁用' } as Record<string, string>)[s || ''] || s || '—';
}

function statusTagType(s?: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ draft: 'info', pending_review: 'warning', approved: 'success', rejected: 'danger', disabled: 'info' } as any)[s || ''] || 'info';
}

function countByScene(scene: string): number {
  return allItems.value.filter((t) => t.scene === scene).length;
}

async function loadData(): Promise<void> {
  try {
    const res = await http.get('/admin/sms-templates');
    allItems.value = res.items || [];
  } catch (err) {
    console.error(err);
  }
}

async function onInitDefaults(): Promise<void> {
  await ElMessageBox.confirm(
    '将自动创建 7 个默认模板（每个场景一个），已存在的不会被覆盖。继续？',
    '一键初始化',
    { type: 'success' },
  );
  initializing.value = true;
  try {
    const res = await http.post('/admin/sms-templates/init-defaults');
    ElMessage.success(`创建了 ${res.created} 个默认模板`);
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '初始化失败');
  } finally {
    initializing.value = false;
  }
}

function resetEditing(): void {
  Object.assign(editing, {
    id: 0,
    scene: 'login',
    name: '',
    signName: '舆情监测',
    templateContent: '',
    remark: '',
    setDefault: true,
  });
}

function openCreateDialog(): void {
  resetEditing();
  dialogVisible.value = true;
}

function openEditDialog(item: Template): void {
  Object.assign(editing, {
    id: item.id,
    scene: item.scene,
    name: item.name,
    signName: item.signName,
    templateContent: item.templateContent,
    remark: item.remark || '',
    setDefault: item.isDefault === 1,
  });
  dialogVisible.value = true;
}

async function onSave(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      if (editing.id) {
        await http.put(`/admin/sms-templates/${editing.id}`, {
          name: editing.name,
          signName: editing.signName,
          content: editing.templateContent,
          remark: editing.remark,
          setDefault: editing.setDefault,
        });
      } else {
        await http.post('/admin/sms-templates', {
          scene: editing.scene,
          name: editing.name,
          signName: editing.signName,
          content: editing.templateContent,
          remark: editing.remark,
          setDefault: editing.setDefault,
        });
      }
      ElMessage.success('保存成功');
      dialogVisible.value = false;
      loadData();
    } catch (err: any) {
      ElMessage.error(err?.message || '保存失败');
    } finally {
      saving.value = false;
    }
  });
}

function onTest(item: Template): void {
  if (!item.templateCode) {
    ElMessage.warning('该模板尚未提交阿里云，无法直接测试');
    return;
  }
  ElMessage.info('测试发送需在配置阿里云短信服务并填入真实手机号，可使用 /admin/sms/test 端点进行完整联调');
}

function onSubmit(item: Template): void {
  if (item.status === 'pending_review') {
    ElMessage.warning('该模板已提交审核中，请等待');
    return;
  }
  if (item.status === 'approved') {
    ElMessage.warning('该模板已通过审核，无需重复提交');
    return;
  }
  submittingItem.value = item;
  submitVisible.value = true;
}

async function onConfirmSubmit(): Promise<void> {
  if (!submittingItem.value) return;
  submitting.value = true;
  try {
    const res = await http.post(`/admin/sms-templates/${submittingItem.value.id}/submit`);
    ElMessage.success(`提交成功，templateCode=${res.templateCode || '—'}，请稍后同步审核状态`);
    submitVisible.value = false;
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '提交失败');
  } finally {
    submitting.value = false;
  }
}

async function onSync(item: Template): Promise<void> {
  try {
    const res = await http.post(`/admin/sms-templates/${item.id}/sync-status`);
    ElMessage.success(`最新状态：${statusLabel(res.status)}`);
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '同步失败');
  }
}

async function onDelete(item: Template): Promise<void> {
  await ElMessageBox.confirm(`确认删除模板 "${item.name}"?`, '删除确认', { type: 'warning' });
  try {
    await http.delete(`/admin/sms-templates/${item.id}`);
    ElMessage.success('已删除');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败');
  }
}

async function onSetDefault(item: Template): Promise<void> {
  try {
    await http.post(`/admin/sms-templates/${item.id}/set-default`);
    ElMessage.success('已设为默认');
    loadData();
  } catch (err: any) {
    ElMessage.error(err?.message || '设置失败');
  }
}

onMounted(loadData);
</script>

<style scoped>
.scene-tabs :deep(.el-tabs__nav-wrap::after) {
  background: transparent;
}

.scene-tabs :deep(.el-tabs__item) {
  color: var(--text-secondary);
  font-weight: 500;
}

.scene-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-light);
}

.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
