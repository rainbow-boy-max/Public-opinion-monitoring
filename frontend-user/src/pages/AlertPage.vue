<template>
  <div class="alert-page">
    <GlassCard title="预警中心" subtitle="管理预警规则，及时获取异常通知">
      <template #extra>
        <el-button type="primary" :icon="Plus" size="small" @click="openCreate">新建规则</el-button>
      </template>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 20px">
        <template #title>预警规则说明</template>
        根据条件类型（负面情感占比 / 声量突增 / 关键词匹配 / 指定平台），当满足条件时通过站内通知、Webhook 或短信发送告警。
      </el-alert>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="预警规则" name="rules">
          <div class="rule-grid">
            <article v-for="row in rules" :key="row.id" class="rule-card">
              <div class="rule-card__head">
                <div class="rule-card__name">{{ row.name }}</div>
                <el-switch
                  :model-value="row.status === 'active'"
                  @change="onToggle(row)"
                  size="small"
                />
              </div>
              <div class="rule-card__meta">
                <span class="rule-card__tag">{{ conditionLabel(row.conditionType) }}</span>
                <span class="rule-card__tag rule-card__tag--channel">{{ channelLabel(row.channel) }}</span>
              </div>
              <div class="rule-card__time">
                冷却 {{ row.cooldownMinutes }} 分钟
                <span v-if="row.lastTriggeredAt" class="rule-card__triggered">
                  上次触发 {{ formatDate(row.lastTriggeredAt) }}
                </span>
              </div>
              <div class="rule-card__actions">
                <el-button size="small" @click="openEdit(row)">编辑</el-button>
                <el-button size="small" :loading="checkingId === row.id" @click="onCheckNow(row)">测试</el-button>
                <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
              </div>
            </article>
          </div>
          <el-empty v-if="!loading && rules.length === 0" description="暂无预警规则" />
        </el-tab-pane>

        <el-tab-pane label="触发记录" name="logs">
          <el-table :data="logs" v-loading="loadingLogs" stripe size="small" style="width: 100%">
            <el-table-column prop="title" label="标题" min-width="160" />
            <el-table-column prop="message" label="消息" min-width="200" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'sent' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'sent' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="totalLogs > pageSize" class="pagination-wrap">
            <el-pagination
              v-model:current-page="logPage"
              :page-size="pageSize"
              :total="totalLogs"
              layout="prev, pager, next"
              size="small"
              @current-change="loadLogs"
            />
          </div>
          <el-empty v-if="!loadingLogs && logs.length === 0" description="暂无触发记录" />
        </el-tab-pane>
      </el-tabs>
    </GlassCard>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑规则' : '新建规则'" width="660">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：负面舆情预警" />
        </el-form-item>
        <el-form-item label="条件类型" prop="conditionType">
          <el-select v-model="form.conditionType" style="width: 100%" @change="onTypeChange">
            <el-option value="sentiment_negative" label="负面情感占比" />
            <el-option value="volume_spike" label="声量突增" />
            <el-option value="keyword_match" label="关键词匹配" />
            <el-option value="platform_specific" label="指定平台" />
          </el-select>
        </el-form-item>

        <template v-if="form.conditionType === 'sentiment_negative'">
          <el-form-item label="触发阈值">
            <el-slider v-model="sentimentForm.threshold" :min="0" :max="100" show-input style="width: 260px" />
          </el-form-item>
          <el-form-item label="时间窗口">
            <el-select v-model="sentimentForm.timeWindow">
              <el-option :value="5" label="5 分钟" />
              <el-option :value="15" label="15 分钟" />
              <el-option :value="30" label="30 分钟" />
              <el-option :value="60" label="60 分钟" />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="form.conditionType === 'volume_spike'">
          <el-form-item label="触发阈值">
            <el-input-number v-model="volumeForm.threshold" :min="1" :max="100000" />
          </el-form-item>
          <el-form-item label="时间窗口">
            <el-select v-model="volumeForm.timeWindow">
              <el-option :value="5" label="5 分钟" />
              <el-option :value="15" label="15 分钟" />
              <el-option :value="30" label="30 分钟" />
              <el-option :value="60" label="60 分钟" />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="form.conditionType === 'keyword_match'">
          <el-form-item label="关键词">
            <el-select v-model="keywordForm.keywords" multiple filterable allow-create default-first-option placeholder="输入关键词后回车" style="width: 100%">
              <el-option v-for="k in keywordForm.keywords" :key="k" :label="k" :value="k" />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="form.conditionType === 'platform_specific'">
          <el-form-item label="选择平台">
            <el-select v-model="platformForm.platforms" multiple placeholder="选择平台" style="width: 100%">
              <el-option label="微信" value="weixin" />
              <el-option label="微信视频号" value="weixin_video" />
              <el-option label="抖音" value="douyin" />
              <el-option label="小红书" value="xiaohongshu" />
              <el-option label="快手" value="kuaishou" />
              <el-option label="微博" value="weibo" />
              <el-option label="百家号" value="baijiahao" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="通知渠道" prop="channel">
          <el-select v-model="form.channel" style="width: 100%" @change="onChannelChange">
            <el-option value="internal" label="站内通知" />
            <el-option value="webhook" label="Webhook" />
            <el-option value="sms" label="短信" />
          </el-select>
        </el-form-item>

        <template v-if="form.channel === 'webhook'">
          <el-form-item label="选择 Webhook">
            <el-select v-model="webhookForm.webhookId" placeholder="选择已创建的 Webhook" style="width: 100%">
              <el-option v-for="w in webhooks" :key="w.id" :label="w.name" :value="w.id" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="冷却时间">
          <el-input-number v-model="form.cooldownMinutes" :min="0" :max="1440" />
          <span style="margin-left: 8px; font-size: 12px; color: var(--text-tertiary)">分钟</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface AlertRule {
  id: number;
  name: string;
  conditionType: string;
  conditionConfig: string;
  channel: string;
  channelConfig: string | null;
  status: string;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface Webhook { id: number; name: string; }

const activeTab = ref('rules');
const rules = ref<AlertRule[]>([]);
const webhooks = ref<Webhook[]>([]);
const logs = ref<any[]>([]);
const loading = ref(false);
const loadingLogs = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editing = ref<AlertRule | null>(null);
const formRef = ref<FormInstance>();
const checkingId = ref<number | null>(null);
const logPage = ref(1);
const pageSize = 20;
const totalLogs = ref(0);

const form = reactive({
  name: '',
  conditionType: 'sentiment_negative' as string,
  channel: 'internal' as string,
  cooldownMinutes: 60,
});

const sentimentForm = reactive({ threshold: 50, timeWindow: 15 });
const volumeForm = reactive({ threshold: 100, timeWindow: 15 });
const keywordForm = reactive({ keywords: [] as string[] });
const platformForm = reactive({ platforms: [] as string[] });
const webhookForm = reactive({ webhookId: null as number | null });

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  conditionType: [{ required: true, message: '请选择条件类型', trigger: 'change' }],
  channel: [{ required: true, message: '请选择通知渠道', trigger: 'change' }],
};

function conditionLabel(t: string): string {
  return ({
    sentiment_negative: '负面情感',
    volume_spike: '声量突增',
    keyword_match: '关键词',
    platform_specific: '指定平台',
  } as Record<string, string>)[t] || t;
}

function channelLabel(c: string): string {
  return ({ internal: '站内通知', webhook: 'Webhook', sms: '短信' } as Record<string, string>)[c] || c;
}

function formatDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function onTypeChange(): void {
  sentimentForm.threshold = 50;
  sentimentForm.timeWindow = 15;
  volumeForm.threshold = 100;
  volumeForm.timeWindow = 15;
  keywordForm.keywords = [];
  platformForm.platforms = [];
}

function onChannelChange(): void {
  webhookForm.webhookId = null;
}

function buildConditionConfig(): Record<string, unknown> {
  switch (form.conditionType) {
    case 'sentiment_negative': return { threshold: sentimentForm.threshold, timeWindow: sentimentForm.timeWindow };
    case 'volume_spike': return { threshold: volumeForm.threshold, timeWindow: volumeForm.timeWindow };
    case 'keyword_match': return { keywords: keywordForm.keywords };
    case 'platform_specific': return { platforms: platformForm.platforms };
    default: return {};
  }
}

function buildChannelConfig(): Record<string, unknown> | undefined {
  if (form.channel === 'webhook' && webhookForm.webhookId) {
    return { webhookId: webhookForm.webhookId };
  }
  return undefined;
}

function setConditionConfig(config: Record<string, unknown>): void {
  sentimentForm.threshold = (config.threshold as number) ?? 50;
  sentimentForm.timeWindow = (config.timeWindow as number) ?? 15;
  volumeForm.threshold = (config.threshold as number) ?? 100;
  volumeForm.timeWindow = (config.timeWindow as number) ?? 15;
  keywordForm.keywords = (config.keywords as string[]) || [];
  platformForm.platforms = (config.platforms as string[]) || [];
}

async function loadRules(): Promise<void> {
  loading.value = true;
  try {
    rules.value = await http.get('/alert/rules');
  } catch (err) { console.error(err); } finally { loading.value = false; }
}

async function loadWebhooks(): Promise<void> {
  try { webhooks.value = await http.get('/webhooks'); } catch { /* ignore */ }
}

async function loadLogs(): Promise<void> {
  loadingLogs.value = true;
  try {
    const res = await http.get(`/alert/logs?page=${logPage.value}&limit=${pageSize}`);
    logs.value = res.items;
    totalLogs.value = res.total;
  } catch (err) { console.error(err); } finally { loadingLogs.value = false; }
}

function openCreate(): void {
  editing.value = null;
  form.name = '';
  form.conditionType = 'sentiment_negative';
  form.channel = 'internal';
  form.cooldownMinutes = 60;
  onTypeChange();
  webhookForm.webhookId = null;
  dialogVisible.value = true;
}

function openEdit(rule: AlertRule): void {
  editing.value = rule;
  form.name = rule.name;
  form.conditionType = rule.conditionType;
  form.channel = rule.channel;
  form.cooldownMinutes = rule.cooldownMinutes;
  setConditionConfig(JSON.parse(rule.conditionConfig));
  if (rule.channelConfig) {
    const cc = JSON.parse(rule.channelConfig);
    webhookForm.webhookId = cc.webhookId || null;
  }
  dialogVisible.value = true;
}

async function onSave(): Promise<void> {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    saving.value = true;
    try {
      const payload = {
        name: form.name,
        conditionType: form.conditionType,
        conditionConfig: buildConditionConfig(),
        channel: form.channel,
        channelConfig: buildChannelConfig(),
        cooldownMinutes: form.cooldownMinutes,
      };
      if (editing.value) {
        await http.put(`/alert/rules/${editing.value.id}`, payload);
        ElMessage.success('更新成功');
      } else {
        await http.post('/alert/rules', payload);
        ElMessage.success('创建成功');
      }
      dialogVisible.value = false;
      await loadRules();
    } catch (err: any) { ElMessage.error(err?.message || '操作失败'); } finally { saving.value = false; }
  });
}

async function onToggle(rule: AlertRule): Promise<void> {
  try {
    await http.post(`/alert/rules/${rule.id}/toggle`);
    rule.status = rule.status === 'active' ? 'paused' : 'active';
    ElMessage.success(rule.status === 'active' ? '已启用' : '已暂停');
  } catch (err: any) { ElMessage.error(err?.message || '操作失败'); }
}

async function onCheckNow(rule: AlertRule): Promise<void> {
  checkingId.value = rule.id;
  try {
    await http.post(`/alert/check-now/${rule.id}`);
    ElMessage.success('检查完成');
  } catch (err: any) { ElMessage.error(err?.message || '检查失败'); } finally { checkingId.value = null; }
}

async function onDelete(rule: AlertRule): Promise<void> {
  await ElMessageBox.confirm(`确认删除规则 "${rule.name}"?`, '操作确认', { type: 'warning' });
  await http.delete(`/alert/rules/${rule.id}`);
  ElMessage.success('已删除');
  await loadRules();
}

onMounted(() => { loadRules(); loadWebhooks(); loadLogs(); });
</script>

<style scoped>
.rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.rule-card {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.rule-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 8px 30px rgba(0, 5, 30, 0.3);
}

.rule-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rule-card__name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.rule-card__meta {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.rule-card__tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(94, 114, 228, 0.15);
  color: var(--color-primary);
}

.rule-card__tag--channel {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}

.rule-card__time {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.rule-card__triggered {
  margin-left: 8px;
}

.rule-card__actions {
  display: flex;
  gap: 4px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
