<template>
  <div class="pr-page">
    <GlassCard title="一句话舆情分析" subtitle="输入一句话，系统自动完成监控→分析→追踪→报告">
      <div class="oneclick-area">
        <el-input
          v-model="oneClickQuery"
          type="textarea"
          :rows="2"
          placeholder="输入分析需求，例如：帮我分析一下最近一周关于华为Mate 70的舆情"
          :disabled="oneClickRunning"
        />
        <div class="oneclick-actions">
          <el-button type="primary" :loading="oneClickRunning" :disabled="!oneClickQuery.trim()" @click="startOneClickAnalysis">
            {{ oneClickRunning ? '分析中...' : '开始分析' }}
          </el-button>
        </div>
        <div v-if="oneClickRunning" class="oneclick-progress">
          <div class="progress-steps">
            <div
              v-for="s in oneClickSteps"
              :key="s.key"
              class="progress-step"
              :class="{
                active: s.key === oneClickStage,
                done: oneClickStageIndex > oneClickStepIndex(s.key),
                failed: oneClickStage === 'failed'
              }"
            >
              <span class="step-dot"></span>
              <span class="step-label">{{ s.label }}</span>
            </div>
          </div>
          <el-progress :percentage="oneClickPercent" :stroke-width="4" status="success" />
          <p class="progress-msg">{{ oneClickMessage }}</p>
        </div>
      </div>
    </GlassCard>

    <GlassCard title="AI 公关方案" subtitle="舆情报告与周期性分析">
      <template #extra>
        <el-dropdown v-if="reports.length > 0" @command="onExportReport">
          <el-button type="primary" :icon="Plus">导出报告</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="md">导出 Markdown</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
              <el-dropdown-item command="docx">导出 Word</el-dropdown-item>
              <el-dropdown-item command="xlsx">导出 Excel</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" :icon="Plus" @click="openCustomDialog">自定义舆情分析</el-button>
      </template>

      <div v-if="loading" class="loading-area"><el-skeleton :rows="4" animated /></div>

      <div v-else-if="reports.length > 0" class="report-list">
        <article v-for="r in reports" :key="r.id" class="report-card" @click="openReport(r)">
          <div class="report-card__head">
            <div class="report-card__meta">
              <div class="report-card__title">报告 #{{ r.id }}</div>
              <div class="report-card__time">{{ formatDate(r.createdAt) }}</div>
            </div>
            <el-tag :type="r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'" size="small">
              {{ r.status === 'completed' ? '已完成' : r.status === 'generating' ? '生成中' : r.status === 'failed' ? '失败' : '待处理' }}
            </el-tag>
          </div>
          <div class="report-card__body">
            <span v-if="r.modelUsed">模型：<code>{{ r.modelUsed }}</code></span>
            <span v-if="r.tokensUsed"> · {{ r.tokensUsed }} tokens</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <el-empty description="暂无公关报告">
          <el-button type="primary" size="large" @click="loadMockReport">加载示例报告</el-button>
        </el-empty>
      </div>
    </GlassCard>

    <el-dialog v-model="customVisible" title="自定义舆情分析" width="700" :close-on-click-modal="false" top="5vh" class="pr-dialog">
      <div class="pr-dialog__body">
      <el-tabs v-model="inputTab" @tab-change="onTabChange">
        <el-tab-pane label="📋 选择事件" name="event">
          <p class="tab-desc">从正在监控的舆情事件中选择分析对象</p>
          <el-input v-model="eventSearch" placeholder="搜索事件标题..." clearable style="margin-bottom:12px" @input="onEventSearch" />
          <div v-if="searchingEvents" class="loading-events"><el-skeleton :rows="3" animated /></div>
          <div v-else class="event-list">
            <div v-for="e in searchResults" :key="e.id" class="event-item" :class="{ selected: selectedEventId === e.id }" @click="selectedEventId = e.id">
              <div class="event-item__title">{{ e.title }}</div>
              <div class="event-item__meta">
                <PlatformTag :platform="e.platform" size="small" />
                <span>{{ e.sentiment === 'positive' ? '😊' : e.sentiment === 'negative' ? '😡' : '😐' }}</span>
                <span class="event-item__time">{{ formatDate(e.matchedAt) }}</span>
              </div>
            </div>
            <div v-if="searchResults.length === 0 && !eventSearch" class="text-muted" style="text-align:center;padding:20px">输入关键词搜索已有舆情事件</div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="🔗 输入链接" name="url">
          <p class="tab-desc">输入网页链接，系统将自动抓取内容进行分析</p>
          <el-input v-model="urlInput" placeholder="https://..." clearable />
          <div v-if="fetchingUrl" class="fetch-status"><el-progress :percentage="50" :stroke-width="4" status="success" /><span>正在抓取链接内容...</span></div>
        </el-tab-pane>

        <el-tab-pane label="📎 上传文档" name="doc">
          <p class="tab-desc">上传舆情相关文档（PDF/Word/图片/TXT），提取文字后分析</p>
          <el-upload ref="uploadRef" action="/api/upload" :headers="uploadHeaders" :on-success="onUploadSuccess" :on-error="onUploadError" :limit="1" :accept="'.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp'" :auto-upload="true">
            <el-button type="primary">选择文件</el-button>
            <template #tip><div class="upload-tip">支持 PDF / Word / TXT / 图片，单个文件最大 20MB</div></template>
          </el-upload>
          <div v-if="uploadedFile" class="upload-status">
            <el-tag type="success" closable @close="uploadedFile = ''" class="upload-tag">{{ uploadedFile }}</el-tag>
          </div>
        </el-tab-pane>
      </el-tabs>

      <el-divider />

      <el-form :model="customForm" label-width="0">
        <el-form-item label="AI 智能体（可选）">
          <el-select v-model="customForm.agentId" placeholder="选择 AI 智能体生成解决方案" style="width:100%" clearable :disabled="submitting">
            <el-option v-for="a in agents" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <div v-if="submitting" class="generating-hint">
          <el-progress :percentage="progressPercent" :stroke-width="6" status="warning" />
          <p>AI 正在分析中，请稍候...</p>
        </div>
      </el-form>
      </div>

      <template #footer>
        <el-button @click="customVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="onSubmitAnalysis">
          {{ submitting ? '分析中...' : '提交分析' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reportVisible" title="报告详情" width="800" top="5vh">
      <div v-if="currentReport" class="report-detail">
        <div class="report-section__body render-markdown" v-html="renderMarkdown(currentReport.analysis || '')" />
        <div v-if="currentReport.strategy" class="report-section__body render-markdown" v-html="renderMarkdown(currentReport.strategy || '')" style="margin-top:20px" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PrReportsPage' });
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';

const oneClickQuery = ref('');
const oneClickRunning = ref(false);
const oneClickStage = ref('');
const oneClickPercent = ref(0);
const oneClickMessage = ref('');
const oneClickResult = ref<any>(null);

const oneClickSteps = [
  { key: 'understand', label: '理解需求' },
  { key: 'monitor', label: '搜索事件' },
  { key: 'analyze', label: '分析数据' },
  { key: 'track', label: '追踪传播' },
  { key: 'report', label: '生成报告' },
];

const oneClickStageOrder = ['understand', 'monitor', 'analyze', 'track', 'report', 'done'];

const oneClickStageIndex = computed(() => {
  const idx = oneClickStageOrder.indexOf(oneClickStage.value);
  return idx >= 0 ? idx : -1;
});

function oneClickStepIndex(key: string): number {
  return oneClickSteps.findIndex((s) => s.key === key);
}

const loading = ref(false);
const reports = ref<any[]>([]);
const reportVisible = ref(false);
const currentReport = ref<any>(null);
const customVisible = ref(false);
const submitting = ref(false);
const progressPercent = ref(0);
const agents = ref<Array<{ id: number; name: string }>>([]);

const inputTab = ref('event');
const eventSearch = ref('');
const searchResults = ref<any[]>([]);
const searchingEvents = ref(false);
const selectedEventId = ref<number | null>(null);
const urlInput = ref('');
const fetchingUrl = ref(false);
const uploadedFile = ref('');

const customForm = reactive({ agentId: 0 });

let pollTimer: ReturnType<typeof setInterval> | null = null;
const uploadHeaders = ref<Record<string, string>>({});

const canSubmit = computed(() => {
  if (inputTab.value === 'event') return selectedEventId.value !== null;
  if (inputTab.value === 'url') return urlInput.value.trim().length > 0;
  return uploadedFile.value.length > 0;
});

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function renderMarkdown(md: string): string {
  if (!md) return '';
  let h = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  h = h.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  h = h.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>(.|\n)+?<\/li>)+/g, m => `<ul>${m}</ul>`);
  h = h.replace(/\n\n/g, '</p><p>');
  return `<p>${h}</p>`;
}

function loadMockReport() {
  reports.value = [
    { id: 1, status: 'completed', createdAt: new Date().toISOString(), modelUsed: 'DeepSeek-V3', tokensUsed: 2856, analysis: '## 舆情深度分析\n\n事件性质：产品质量负面舆情。\n当前传播态势：已在微博、微信、抖音等多平台传播。', strategy: '## 应对方案\n\n1. 立即发布官方声明\n2. 成立专项调查组' },
    { id: 2, status: 'completed', createdAt: new Date(Date.now() - 86400000).toISOString(), modelUsed: 'GPT-4o', tokensUsed: 4120, analysis: '## 本周舆情综述\n\nAI 相关讨论占比 38%，环比上升 12%' },
  ];
}

async function onExportReport(format: string): Promise<void> {
  if (currentReport.value) {
    const text = currentReport.value.analysis || '';
    const mdContent = text;
    const title = `报告 #${currentReport.value.id}`;
    const sections = [{ heading: '分析内容', content: mdContent, type: 'text' as const }];
    if (currentReport.value.strategy) {
      sections.push({ heading: '应对方案', content: currentReport.value.strategy, type: 'text' as const });
    }

    try {
      const blob = await http.post('/export/data', { title, sections, format }, { responseType: 'blob' }) as Blob;
      const extMap: Record<string, string> = { md: 'md', pdf: 'pdf', docx: 'doc', xlsx: 'xlsx' };
      const ext = extMap[format] || format;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${currentReport.value.id}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('导出成功');
    } catch {
      ElMessage.error('导出失败');
    }
  } else {
    ElMessage.warning('请先选择一个报告');
  }
}

async function startOneClickAnalysis() {
  if (!oneClickQuery.value.trim()) return;
  oneClickRunning.value = true;
  oneClickResult.value = null;
  oneClickStage.value = 'understand';
  oneClickPercent.value = 0;

  try {
    const response = await fetch('/api/agents/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('user_token') || ''}`,
      },
      body: JSON.stringify({ query: oneClickQuery.value.trim() }),
    });

    if (!response.ok) throw new Error('请求失败');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.stage) {
              oneClickStage.value = data.stage;
              oneClickPercent.value = data.progress || 0;
              oneClickMessage.value = data.message || '';
            }
          } catch {}
        }
      }
    }

    ElMessage.success('分析完成');
    oneClickStage.value = 'done';
    oneClickPercent.value = 100;
    oneClickMessage.value = '分析完成';
    await loadReports();
    const lastReport = reports.value[0];
    if (lastReport) {
      currentReport.value = lastReport;
      reportVisible.value = true;
    }
  } catch (err: any) {
    oneClickStage.value = 'failed';
    ElMessage.error(err?.message || '分析失败');
  } finally {
    oneClickRunning.value = false;
  }
}

async function loadReports(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get('/pr/reports', { params: { page: 1, pageSize: 50 } });
    reports.value = res.items || [];
  } catch { /* ignore */ } finally { loading.value = false; }
}

async function loadAgents(): Promise<void> {
  try {
    const res = await http.get('/agents');
    agents.value = (res.items || []).map((a: any) => ({ id: a.id, name: a.name }));
  } catch { /* ignore */ }
}

function openReport(r: any) {
  currentReport.value = r;
  reportVisible.value = true;
}

function onTabChange() {
  selectedEventId.value = null;
  urlInput.value = '';
  uploadedFile.value = '';
  if (inputTab.value === 'event') onEventSearch();
}

async function openCustomDialog() {
  inputTab.value = 'event';
  selectedEventId.value = null;
  urlInput.value = '';
  uploadedFile.value = '';
  customForm.agentId = 0;
  progressPercent.value = 0;
  customVisible.value = true;
  setTimeout(() => onEventSearch(), 100);
  const token = localStorage.getItem('user_token') || '';
  uploadHeaders.value = { Authorization: `Bearer ${token}` };
}

async function onEventSearch() {
  searchingEvents.value = true;
  try {
    const res = await http.get('/pr/events/search', { params: { q: eventSearch.value, limit: 20 } });
    searchResults.value = Array.isArray(res) ? res : [];
  } catch { searchResults.value = []; } finally { searchingEvents.value = false; }
}

function onUploadSuccess(res: any) {
  uploadedFile.value = res.name || '文件已上传';
  ElMessage.success('文件上传成功');
}

function onUploadError() {
  ElMessage.error('文件上传失败');
}

async function onSubmitAnalysis() {
  submitting.value = true;
  progressPercent.value = 10;
  try {
    let payload: Record<string, any> = {};
    if (inputTab.value === 'event') payload.eventId = selectedEventId.value;
    if (inputTab.value === 'url') payload.url = urlInput.value.trim();
    if (inputTab.value === 'doc') payload.fileText = uploadedFile.value;
    if (customForm.agentId) payload.agentId = customForm.agentId;

    const res = await http.post('/pr/analyze', payload);
    progressPercent.value = 30;
    await pollReport(res.reportId);
  } catch (err: any) {
    ElMessage.error(err?.message || '提交分析失败');
    submitting.value = false;
    progressPercent.value = 0;
  }
}

async function pollReport(reportId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let elapsed = 0;
    const interval = 2000;
    pollTimer = setInterval(async () => {
      elapsed += interval;
      progressPercent.value = Math.min(90, 30 + Math.floor(elapsed / 120000 * 60));
      try {
        const r = await http.get(`/pr/reports/${reportId}`);
        if (r.status === 'completed') {
          clearInterval(pollTimer!); pollTimer = null;
          progressPercent.value = 100;
          setTimeout(() => { submitting.value = false; }, 500);
          await loadReports();
          ElMessage.success('分析完成');
          currentReport.value = r;
          reportVisible.value = true;
          customVisible.value = false;
          resolve();
        } else if (r.status === 'failed') {
          clearInterval(pollTimer!); pollTimer = null;
          submitting.value = false;
          ElMessage.error(r.errorMessage || '分析失败');
          reject(new Error(r.errorMessage));
        }
      } catch {
        clearInterval(pollTimer!); pollTimer = null;
        submitting.value = false;
        reject(new Error('查询状态失败'));
      }
    }, interval);
  });
}

onMounted(() => { loadMockReport(); loadReports(); loadAgents(); });
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.pr-page { display: flex; flex-direction: column; gap: 20px; }
.oneclick-area { padding: 8px 0; }
.oneclick-actions { margin-top: 12px; }
.oneclick-progress { margin-top: 16px; padding: 12px; background: var(--glass-bg); border-radius: var(--radius-sm); }
.progress-steps { display: flex; gap: 16px; margin-bottom: 12px; justify-content: center; }
.progress-step { display: flex; align-items: center; gap: 4px; }
.step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--el-fill-color-lighter); display: inline-block; }
.progress-step.active .step-dot { background: var(--color-primary); }
.progress-step.done .step-dot { background: var(--el-color-success); }
.progress-step.failed .step-dot { background: var(--el-color-danger); }
.step-label { font-size: 12px; color: var(--text-tertiary); }
.progress-step.active .step-label { color: var(--color-primary); font-weight: 600; }
.progress-step.done .step-label { color: var(--el-color-success); }
.progress-msg { font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 8px; }
.loading-area { padding: 40px; }
.empty-state { margin: 40px 0; }
.report-list { display: flex; flex-direction: column; gap: 12px; }
.report-card {
  padding: 16px; background: var(--glass-bg); border-radius: var(--radius-md);
  border: 1px solid var(--glass-border); cursor: pointer;
}
.report-card:hover { border-color: var(--color-primary-dark); }
.report-card__head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.report-card__title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.report-card__time { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.report-card__body { font-size: 12px; color: var(--text-secondary); }
.pr-dialog :deep(.el-dialog__body) { padding: 16px 24px; max-height: 70vh; overflow-y: auto; }
.pr-dialog__body { overflow-y: auto; }
.tab-desc { font-size: 13px; color: var(--text-tertiary); margin-bottom: 12px; }
.event-list { max-height: 220px; overflow-y: auto; }
.event-item { padding: 10px 12px; margin-bottom: 6px; background: var(--glass-bg); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; }
.event-item:hover { border-color: var(--color-primary-dark); }
.event-item.selected { border-color: var(--color-primary); background: rgba(94,114,228,0.08); }
.event-item__title { font-size: 14px; font-weight: 500; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.event-item__meta { display: flex; gap: 8px; font-size: 12px; color: var(--text-tertiary); align-items: center; flex-wrap: wrap; }
.event-item__time { white-space: nowrap; }
.loading-events { padding: 20px; }
.fetch-status { margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.fetch-status .el-progress { width: 120px; flex-shrink: 0; }
.upload-status { margin-top: 12px; }
.upload-tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.upload-tip { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
.generating-hint { text-align: center; padding: 12px 0; }
.generating-hint p { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
.text-muted { color: var(--text-tertiary); font-size: 13px; }
.render-markdown { line-height: 1.8; color: var(--text-primary); font-size: 14px; }
.render-markdown h2, .render-markdown h3, .render-markdown h4 { margin: 16px 0 8px; }
.render-markdown ul { padding-left: 20px; }
.render-markdown li { margin: 4px 0; }
</style>
