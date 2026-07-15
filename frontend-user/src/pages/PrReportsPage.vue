<template>
  <div class="pr-page">
    <GlassCard title="AI 公关方案" icon="🎯" subtitle="舆情报告与周期性分析">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="openCustomDialog">自定义舆情分析</el-button>
      </template>

      <el-tabs v-model="activeTab" class="pr-tabs">
        <el-tab-pane label="单事件报告" name="single">
          <el-empty v-if="reports.length === 0 && !loading" description="还没有报告，从实时大屏或下方入口生成第一份公关方案">
            <el-button type="primary" @click="$router.push('/realtime')">前往实时大屏</el-button>
          </el-empty>

          <div class="report-list">
            <article
              v-for="r in reports"
              :key="r.id"
              class="report-card"
              :class="reportCardClass(r.status)"
              @click="openReport(r)"
            >
              <div class="report-card__head">
                <div class="report-card__status-icon">{{ statusIcon(r.status) }}</div>
                <div class="report-card__meta">
                  <div class="report-card__title">
                    报告 #{{ r.id }}
                    <el-tag v-if="r.reportType === 'periodic'" size="small" type="warning" effect="plain" style="margin-left: 6px">
                      {{ r.periodicFreq === 'daily' ? '日报' : '周报' }}
                    </el-tag>
                    <span class="report-card__status-label">{{ statusLabel(r.status) }}</span>
                  </div>
                  <div class="report-card__time">{{ formatDate(r.createdAt) }}</div>
                </div>
              </div>
              <div class="report-card__body">
                <span v-if="r.modelUsed">模型：<code>{{ r.modelUsed }}</code></span>
                <span v-if="r.tokensUsed"> · Tokens：{{ r.tokensUsed }}</span>
                <span v-if="r.latencyMs"> · {{ r.latencyMs }}ms</span>
              </div>
            </article>
          </div>
        </el-tab-pane>

        <el-tab-pane label="周期性报告" name="periodic">
          <el-form :model="periodicForm" class="periodic-form" label-width="80px">
            <el-form-item label="频率">
              <el-select v-model="periodicForm.freq" style="width: 140px">
                <el-option label="日报" value="daily" />
                <el-option label="周报" value="weekly" />
              </el-select>
            </el-form-item>
            <el-form-item label="监控任务">
              <el-select
                v-model="periodicForm.taskIds"
                multiple
                placeholder="选择监控任务"
                style="width: 360px"
              >
                <el-option v-for="t in monitorTasks" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="generatingPeriodic" @click="generatePeriodicReport">生成报告</el-button>
            </el-form-item>
          </el-form>

          <div v-if="generatingPeriodic && !periodicReport" class="periodic-loading">
            <el-progress :percentage="50" status="warning" :show-text="false" />
            <p>AI 正在分析数据生成报告...</p>
          </div>

          <div v-if="periodicReport" class="periodic-result">
            <div class="periodic-result__bar">
              <h3 class="periodic-result__title">{{ extractTitle(periodicReport.analysis || '') }}</h3>
              <el-button size="small" :icon="Download" @click="handleExport(periodicReport)">导出</el-button>
            </div>
            <div class="periodic-result__meta">
              <el-tag effect="dark" type="success" size="small">{{ periodicReport.modelUsed || '默认模型' }}</el-tag>
              <span class="meta-text">{{ periodicReport.tokensUsed || 0 }} tokens · {{ periodicReport.latencyMs || 0 }}ms</span>
              <span class="meta-text">{{ formatDate(periodicReport.createdAt) }}</span>
            </div>
            <section class="report-section">
              <markdown-renderer :source="periodicReport.analysis || ''" />
            </section>
            <section v-if="periodicReport.strategy" class="report-section">
              <markdown-renderer :source="periodicReport.strategy" />
            </section>
          </div>
        </el-tab-pane>

        <el-tab-pane label="报告订阅" name="schedule">
          <div class="schedule-section">
            <h3 class="section-title">创建订阅</h3>
            <el-form :model="scheduleForm" class="schedule-form" label-width="80px">
              <el-form-item label="名称">
                <el-input v-model="scheduleForm.name" placeholder="订阅名称" style="width: 240px" />
              </el-form-item>
              <el-form-item label="频率">
                <el-select v-model="scheduleForm.freq" style="width: 140px">
                  <el-option label="日报" value="daily" />
                  <el-option label="周报" value="weekly" />
                </el-select>
              </el-form-item>
              <el-form-item label="执行时间">
                <el-time-picker
                  v-model="scheduleForm.time"
                  format="HH:mm"
                  value-format="HH:mm"
                  placeholder="选择时间"
                  style="width: 140px"
                />
              </el-form-item>
              <el-form-item label="监控任务">
                <el-select
                  v-model="scheduleForm.taskIds"
                  multiple
                  placeholder="选择监控任务"
                  style="width: 360px"
                >
                  <el-option v-for="t in monitorTasks" :key="t.id" :label="t.name" :value="t.id" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="creatingSchedule" @click="createSchedule">创建订阅</el-button>
              </el-form-item>
            </el-form>
          </div>

          <div class="schedule-section">
            <h3 class="section-title">订阅列表</h3>
            <el-table :data="schedules" v-loading="loadingSchedules" stripe class="schedule-table">
              <el-table-column prop="name" label="名称" min-width="160" />
              <el-table-column label="频率" width="80">
                <template #default="{ row }">
                  {{ row.freq === 'daily' ? '日报' : '周报' }}
                </template>
              </el-table-column>
              <el-table-column prop="time" label="执行时间" width="100" />
              <el-table-column label="下次执行" min-width="180">
                <template #default="{ row }">
                  {{ row.nextRunAt ? formatDate(row.nextRunAt) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.isActive ? 'success' : 'info'" size="small" effect="dark">
                    {{ row.isActive ? '启用' : '暂停' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" :type="row.isActive ? 'warning' : 'success'" plain @click="toggleSchedule(row)">
                    {{ row.isActive ? '暂停' : '启用' }}
                  </el-button>
                  <el-button size="small" type="danger" plain @click="confirmDeleteSchedule(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </GlassCard>

    <el-dialog
      v-model="reportVisible"
      :title="`AI 公关方案 · 报告 #${currentReport?.id || '-'}`"
      width="900"
      top="6vh"
      destroy-on-close
    >
      <div v-if="currentReport && currentReport.status === 'completed'" class="report-detail">
        <div class="report-meta-bar">
          <el-tag v-if="currentReport.reportType === 'periodic'" effect="dark" type="warning" size="small" style="margin-right: 4px">
            {{ currentReport.periodicFreq === 'daily' ? '日报' : '周报' }}
          </el-tag>
          <el-tag effect="dark" type="success" size="small">
            {{ currentReport.modelUsed || '默认模型' }}
          </el-tag>
          <span class="meta-text">{{ currentReport.tokensUsed || 0 }} tokens · {{ currentReport.latencyMs || 0 }}ms</span>
          <el-button size="small" text @click="onCopyReport(currentReport)">复制结果</el-button>
          <el-button size="small" text :icon="Download" @click="handleExport(currentReport)">导出</el-button>
        </div>
        <section class="report-section">
          <h3>舆情深度分析</h3>
          <markdown-renderer :source="currentReport.analysis || ''" />
        </section>
        <section v-if="currentReport.strategy" class="report-section">
          <h3>公关应对方案</h3>
          <markdown-renderer :source="currentReport.strategy || ''" />
        </section>
      </div>
      <div v-else-if="currentReport && currentReport.status === 'generating'" class="report-pending">
        <el-progress :percentage="60" status="warning" :show-text="false" />
        <p style="margin-top: 16px; color: var(--text-secondary)">AI 正在生成方案，请稍候...</p>
      </div>
      <div v-else-if="currentReport && currentReport.status === 'failed'" class="report-failed">
        <el-result icon="error" title="生成失败" :sub-title="currentReport.errorMessage || '未知错误'">
          <template #extra>
            <el-button type="primary" @click="onRetry">重新生成</el-button>
          </template>
        </el-result>
      </div>
      <div v-else class="report-pending">
        <el-progress :percentage="20" :show-text="false" />
        <p style="margin-top: 16px; color: var(--text-secondary)">任务排队中...</p>
      </div>
    </el-dialog>

    <el-dialog v-model="customVisible" title="自定义舆情内容分析" width="720">
      <el-form :model="customForm" label-width="100px">
        <el-form-item label="标题">
          <el-input v-model="customForm.title" placeholder="为此次舆情命名" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="customForm.text" type="textarea" :rows="8" placeholder="贴入舆情原文或描述" />
        </el-form-item>
        <el-form-item label="选择智能体">
          <el-select v-model="customForm.agentId" placeholder="默认智能体（不选择则使用通用 PR Prompt）">
            <el-option v-for="a in agents" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCustomSubmit">开始生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();

// tab
const activeTab = ref('single');

// existing report list
const reports = ref<any[]>([]);
const loading = ref(false);
const reportVisible = ref(false);
const currentReport = ref<any>(null);

const customVisible = ref(false);
const submitting = ref(false);
const customForm = reactive({ title: '', text: '', agentId: 0 });
const agents = ref<any[]>([]);

// periodic report
const monitorTasks = ref<any[]>([]);
const periodicForm = reactive({ freq: 'daily', taskIds: [] as number[] });
const generatingPeriodic = ref(false);
const periodicReport = ref<any>(null);

// schedules
const schedules = ref<any[]>([]);
const loadingSchedules = ref(false);
const creatingSchedule = ref(false);
const scheduleForm = reactive({ name: '', freq: 'daily', time: '08:00', taskIds: [] as number[] });

const MarkdownRenderer = (props: { source: string }) => {
  const html = renderMarkdown(props.source || '');
  return h('div', { class: 'md-body', innerHTML: html });
};

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(.|\n)+?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;
  return html;
}

function statusIcon(s: string): string {
  return ({ pending: '⏳', generating: '🧠', completed: '✅', failed: '❌' } as any)[s] || '📄';
}

function statusLabel(s: string): string {
  return ({ pending: '排队中', generating: '生成中', completed: '已完成', failed: '生成失败' } as Record<string, string>)[s] || s;
}

function reportCardClass(s: string): string {
  return `report-card--${s}`;
}

function statusType(s: string): 'info' | 'warning' | 'success' | 'danger' {
  return ({ pending: 'info', generating: 'warning', completed: 'success', failed: 'danger' } as any)[s] || 'info';
}

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function loadReports(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get('/pr/reports', { params: { page: 1, pageSize: 50 } });
    reports.value = res.items;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function loadAgents(): Promise<void> {
  try {
    agents.value = await http.get('/agents/available');
  } catch (err) {
    console.error(err);
  }
}

async function openReport(r: any): Promise<void> {
  reportVisible.value = true;
  currentReport.value = r;
  if (r.status === 'pending' || r.status === 'generating') {
    const timer = setInterval(async () => {
      try {
        const fresh = await http.get(`/pr/reports/${r.id}`);
        currentReport.value = fresh;
        if (fresh.status === 'completed' || fresh.status === 'failed') {
          clearInterval(timer);
          loadReports();
        }
      } catch {
        clearInterval(timer);
      }
    }, 2000);
  }
}

async function onRetry(): Promise<void> {
  ElMessage.info('请重新生成');
  reportVisible.value = false;
  customVisible.value = true;
}

function onCopyReport(r: any): void {
  const text = (r.analysis || '') + '\n\n' + (r.strategy || '');
  navigator.clipboard?.writeText(text);
  ElMessage.success('已复制到剪贴板');
}

async function handleExport(r: any): Promise<void> {
  try {
    const res = await http.get(`/pr/reports/${r.id}/export/markdown`, {
      responseType: 'blob',
    } as any);
    const url = URL.createObjectURL(res as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pr-report-${r.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success('报告已导出');
  } catch (err: any) {
    ElMessage.error(err?.message || '导出失败');
  }
}

function extractTitle(md: string): string {
  const m = md.match(/^# (.+)$/m);
  return m ? m[1] : '周期性报告';
}

async function loadMonitorTasks(): Promise<void> {
  try {
    monitorTasks.value = await http.get('/monitor-tasks');
  } catch (err) {
    console.error(err);
  }
}

async function generatePeriodicReport(): Promise<void> {
  if (periodicForm.taskIds.length === 0) {
    ElMessage.warning('请选择至少一个监控任务');
    return;
  }
  generatingPeriodic.value = true;
  periodicReport.value = null;
  try {
    const res = await http.post('/pr/periodic', {
      freq: periodicForm.freq,
      taskIds: periodicForm.taskIds,
    });
    ElMessage.success('报告生成任务已提交');
    pollPeriodicReport(res.reportId);
  } catch (err: any) {
    ElMessage.error(err?.message || '提交失败');
    generatingPeriodic.value = false;
  }
}

function pollPeriodicReport(reportId: number): void {
  const timer = setInterval(async () => {
    try {
      const r = await http.get(`/pr/reports/${reportId}`);
      if (r.status === 'completed') {
        clearInterval(timer);
        generatingPeriodic.value = false;
        periodicReport.value = r;
        loadReports();
      } else if (r.status === 'failed') {
        clearInterval(timer);
        generatingPeriodic.value = false;
        ElMessage.error(r.errorMessage || '报告生成失败');
      }
    } catch {
      clearInterval(timer);
      generatingPeriodic.value = false;
    }
  }, 2000);
}

async function loadSchedules(): Promise<void> {
  loadingSchedules.value = true;
  try {
    schedules.value = await http.get('/pr/periodic-schedule');
  } catch (err) {
    console.error(err);
  } finally {
    loadingSchedules.value = false;
  }
}

async function createSchedule(): Promise<void> {
  if (!scheduleForm.name) {
    ElMessage.warning('请输入订阅名称');
    return;
  }
  if (scheduleForm.taskIds.length === 0) {
    ElMessage.warning('请选择至少一个监控任务');
    return;
  }
  creatingSchedule.value = true;
  try {
    await http.post('/pr/periodic-schedule', {
      name: scheduleForm.name,
      freq: scheduleForm.freq,
      taskIds: scheduleForm.taskIds,
      time: scheduleForm.time,
    });
    ElMessage.success('订阅创建成功');
    scheduleForm.name = '';
    scheduleForm.taskIds = [];
    loadSchedules();
  } catch (err: any) {
    ElMessage.error(err?.message || '创建失败');
  } finally {
    creatingSchedule.value = false;
  }
}

async function toggleSchedule(row: any): Promise<void> {
  try {
    await http.patch(`/pr/periodic-schedule/${row.id}/toggle`);
    loadSchedules();
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败');
  }
}

async function confirmDeleteSchedule(row: any): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除订阅「${row.name}」？此操作不可撤销。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
    await http.delete(`/pr/periodic-schedule/${row.id}`);
    ElMessage.success('已删除');
    loadSchedules();
  } catch {
    // cancelled
  }
}

function openCustomDialog(): void {
  customForm.title = '';
  customForm.text = '';
  customForm.agentId = 0;
  customVisible.value = true;
}

async function onCustomSubmit(): Promise<void> {
  if (!customForm.title || !customForm.text) {
    ElMessage.warning('请填写标题和内容');
    return;
  }
  submitting.value = true;
  try {
    const res = await http.post('/pr/analyze', {
      title: customForm.title,
      text: customForm.text,
      agentId: customForm.agentId || undefined,
    });
    ElMessage.success('已提交，正在生成...');
    customVisible.value = false;
    loadReports();
    setTimeout(async () => {
      await openReport(reports.value.find((r) => r.id === res.reportId) || (await http.get(`/pr/reports/${res.reportId}`)));
    }, 500);
  } catch (err: any) {
    ElMessage.error(err?.message || '提交失败');
  } finally {
    submitting.value = false;
  }
}

// Public API for opening from other components
defineExpose({ load: loadReports });

defineComponent({ MarkdownRenderer });

onMounted(() => {
  loadReports();
  loadAgents();
  loadMonitorTasks();
  loadSchedules();
});
void router;
void statusType;
</script>

<style scoped>
.pr-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.report-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.report-card {
  padding: 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.report-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 8px 24px rgba(94, 114, 228, 0.15);
}

.report-card--completed {
  border-left: 3px solid var(--color-success);
}

.report-card--generating,
.report-card--pending {
  border-left: 3px solid var(--color-warning);
}

.report-card--failed {
  border-left: 3px solid var(--color-danger);
}

.report-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.report-card__status-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.report-card__meta {
  flex: 1;
  min-width: 0;
}

.report-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.report-card__time {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}

.report-card__body {
  font-size: 12px;
  color: var(--text-secondary);
}

.report-card__body code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-primary-light);
}

.report-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.report-meta-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(15, 19, 47, 0.6);
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
}

.meta-text {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
  flex: 1;
}

.report-section {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: rgba(15, 19, 47, 0.4);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

.report-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}

.md-body :deep(h2) { color: var(--color-primary-light); font-size: 16px; margin: 16px 0 8px; }
.md-body :deep(h3) { color: var(--text-primary); font-size: 15px; margin: 14px 0 6px; }
.md-body :deep(h4) { color: var(--text-secondary); font-size: 14px; margin: 12px 0 4px; }
.md-body :deep(p) { color: var(--text-secondary); line-height: 1.7; margin: 8px 0; }
.md-body :deep(ul) { margin: 8px 0 8px 16px; color: var(--text-secondary); }
.md-body :deep(li) { margin: 4px 0; }
.md-body :deep(strong) { color: var(--text-primary); font-weight: 600; }
.md-body :deep(code) { background: rgba(94, 114, 228, 0.15); color: var(--color-primary-light); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
.md-body :deep(em) { color: var(--color-warning); font-style: normal; font-weight: 500; }

.report-pending,
.report-failed {
  text-align: center;
  padding: 60px 0;
}

.pr-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
  border-bottom: 1px solid var(--glass-border);
}

.pr-tabs :deep(.el-tabs__item) {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.pr-tabs :deep(.el-tabs__item.is-active) {
  color: var(--color-primary-light);
}

.pr-tabs :deep(.el-tabs__active-bar) {
  background: var(--gradient-primary);
}

.periodic-form {
  padding: 16px 20px;
  margin-bottom: 16px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.periodic-loading {
  text-align: center;
  padding: 48px 0;
  color: var(--text-secondary);
}

.periodic-loading p {
  margin-top: 16px;
  font-size: 14px;
}

.periodic-result {
  margin-top: 16px;
}

.periodic-result__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.periodic-result__title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.periodic-result__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(15, 19, 47, 0.5);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
}

.schedule-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--glass-border);
}

.schedule-form {
  padding: 16px 20px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.schedule-table {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.schedule-table :deep(.el-table__header th) {
  background: rgba(94, 114, 228, 0.08);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
}

.schedule-table :deep(.el-table__row td) {
  color: var(--text-secondary);
  font-size: 13px;
}

.report-card__status-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: 6px;
  font-weight: 400;
}
</style>
