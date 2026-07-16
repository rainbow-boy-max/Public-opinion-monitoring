<template>
  <div class="pr-page">
    <GlassCard title="AI 公关方案" subtitle="舆情报告与周期性分析">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="openCustomDialog">自定义舆情分析</el-button>
      </template>

      <div v-if="loading" class="loading-area">
        <el-skeleton :rows="4" animated />
      </div>

      <div v-else-if="reports.length > 0" class="report-list">
        <article v-for="r in reports" :key="r.id" class="report-card" @click="openReport(r)">
          <div class="report-card__head">
            <div class="report-card__meta">
              <div class="report-card__title">报告 #{{ r.id }}</div>
              <div class="report-card__time">{{ formatDate(r.createdAt) }}</div>
            </div>
            <el-tag v-if="r.status === 'completed'" type="success" size="small">已完成</el-tag>
            <el-tag v-else-if="r.status === 'generating'" type="warning" size="small">生成中</el-tag>
            <el-tag v-else-if="r.status === 'failed'" type="danger" size="small">失败</el-tag>
          </div>
          <div class="report-card__body">
            <span v-if="r.modelUsed">模型：<code>{{ r.modelUsed }}</code></span>
            <span v-if="r.tokensUsed"> · Tokens：{{ r.tokensUsed }}</span>
            <span v-if="r.latencyMs"> · {{ (r.latencyMs / 1000).toFixed(1) }}s</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <el-empty description="暂无公关报告">
          <el-button type="primary" size="large" @click="loadMockReport">加载示例报告</el-button>
        </el-empty>
      </div>
    </GlassCard>

    <el-dialog v-model="customVisible" title="自定义舆情分析" width="640" :close-on-click-modal="false">
      <el-form :model="customForm" label-width="0">
        <el-form-item>
          <el-input v-model="customForm.title" placeholder="事件标题（可选，自动生成）" :disabled="submitting" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="customForm.text"
            type="textarea"
            :rows="6"
            placeholder="输入舆情事件描述、新闻链接内容、或粘贴需要分析的文本..."
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item v-if="agents.length > 0">
          <el-select v-model="customForm.agentId" placeholder="选择 AI 智能体（可选）" style="width: 100%" :disabled="submitting" clearable>
            <el-option v-for="a in agents" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <div v-if="submitting" class="generating-hint">
          <el-progress :percentage="progressPercent" :stroke-width="6" status="warning" />
          <p>AI 正在分析中，请稍候...</p>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="customVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!customForm.text.trim()" @click="onSubmitAnalysis">
          {{ submitting ? '分析中...' : '提交分析' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reportVisible" title="报告详情" width="800" top="5vh">
      <div v-if="currentReport" class="report-detail">
        <div class="report-section">
          <div class="report-section__body render-markdown" v-html="renderMarkdown(currentReport.analysis || '')" />
        </div>
        <div v-if="currentReport.strategy" class="report-section">
          <div class="report-section__body render-markdown" v-html="renderMarkdown(currentReport.strategy || '')" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PrReportsPage' });
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const reports = ref<any[]>([]);
const reportVisible = ref(false);
const currentReport = ref<any>(null);
const customVisible = ref(false);
const submitting = ref(false);
const progressPercent = ref(0);
const agents = ref<Array<{ id: number; name: string }>>([]);

const customForm = reactive({ title: '', text: '', agentId: 0 });

let pollTimer: ReturnType<typeof setInterval> | null = null;

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(.|\n)+?<\/li>)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

function loadMockReport() {
  reports.value = [
    {
      id: 1, status: 'completed', createdAt: new Date().toISOString(),
      modelUsed: 'DeepSeek-V3', tokensUsed: 2856, latencyMs: 3420,
      analysis: '## 一、舆情深度分析\n\n事件性质：产品质量负面舆情，涉及食品安全问题。\n当前传播态势：事件已在微博、微信、抖音等多平台传播，微博话题阅读量突破 2 亿。\n关键情绪词：愤怒、失望、担忧、质疑',
      strategy: '## 二、潜在风险评估\n\n商业风险：高 - 已有电商平台下架相关产品\n品牌风险：中高 - 品牌口碑指数下降 30%\n\n## 三、公关应对方案\n\n1. 立即发布官方声明\n2. 成立专项调查组\n3. 启动消费者热线',
    },
    {
      id: 2, status: 'completed', createdAt: new Date(Date.now() - 86400000).toISOString(),
      modelUsed: 'GPT-4o', tokensUsed: 4120, latencyMs: 5800,
      analysis: '## 本周舆情综述\n\n本周行业内主要舆情集中在 AI 监管政策、新能源市场竞争格局变化等方面。\n\n### 关键发现\n- AI 相关讨论占比 38%，环比上升 12%\n- 新能源领域关注度持续走高',
      strategy: '## 应对建议\n\n建议持续关注 AI 监管政策走向，提前做好合规准备。',
    },
  ];
}

async function loadReports(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get('/pr/reports', { params: { page: 1, pageSize: 50 } });
    reports.value = res.items || [];
  } catch { /* ignore */ } finally {
    loading.value = false;
  }
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

async function openCustomDialog() {
  customForm.title = '';
  customForm.text = '';
  customForm.agentId = 0;
  progressPercent.value = 0;
  customVisible.value = true;
}

async function onSubmitAnalysis() {
  if (!customForm.text.trim()) return;
  submitting.value = true;
  progressPercent.value = 10;
  try {
    const res = await http.post('/pr/analyze', {
      title: customForm.title || undefined,
      text: customForm.text,
      agentId: customForm.agentId || undefined,
    });
    const reportId = res.reportId;
    progressPercent.value = 30;
    await pollReport(reportId);
  } catch (err: any) {
    ElMessage.error(err?.message || '提交分析失败');
    submitting.value = false;
    progressPercent.value = 0;
  }
}

async function pollReport(reportId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let elapsed = 0;
    const maxWait = 120000;
    const interval = 2000;
    pollTimer = setInterval(async () => {
      elapsed += interval;
      progressPercent.value = Math.min(90, 30 + Math.floor(elapsed / maxWait * 60));
      try {
        const r = await http.get(`/pr/reports/${reportId}`);
        if (r.status === 'completed') {
          clearInterval(pollTimer!);
          pollTimer = null;
          progressPercent.value = 100;
          setTimeout(() => { submitting.value = false; }, 500);
          await loadReports();
          ElMessage.success('分析完成');
          currentReport.value = r;
          reportVisible.value = true;
          resolve();
        } else if (r.status === 'failed') {
          clearInterval(pollTimer!);
          pollTimer = null;
          submitting.value = false;
          ElMessage.error(r.errorMessage || '分析失败');
          reject(new Error(r.errorMessage || '分析失败'));
        }
      } catch {
        clearInterval(pollTimer!);
        pollTimer = null;
        submitting.value = false;
        reject(new Error('查询报告状态失败'));
      }
    }, interval);
  });
}

onMounted(() => {
  loadMockReport();
  loadReports();
  loadAgents();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.pr-page { display: flex; flex-direction: column; gap: 20px; }
.loading-area { padding: 40px; }
.empty-state { margin: 40px 0; }
.report-list { display: flex; flex-direction: column; gap: 12px; }
.report-card {
  padding: 16px; background: var(--glass-bg); border-radius: var(--radius-md);
  border: 1px solid var(--glass-border); cursor: pointer; transition: all var(--transition-fast);
}
.report-card:hover { border-color: var(--color-primary-dark); transform: translateY(-1px); }
.report-card__head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.report-card__title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.report-card__time { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.report-card__body { font-size: 12px; color: var(--text-secondary); }
.report-detail { max-height: 70vh; overflow-y: auto; padding: 0 4px; }
.render-markdown { line-height: 1.8; color: var(--text-primary); font-size: 14px; }
.render-markdown h2, .render-markdown h3, .render-markdown h4 { margin: 16px 0 8px; color: var(--text-primary); }
.render-markdown ul { padding-left: 20px; margin: 8px 0; }
.render-markdown li { margin: 4px 0; }
.render-markdown code { background: rgba(94,114,228,0.1); padding: 2px 6px; border-radius: 3px; font-size: 13px; }
.render-markdown strong { color: var(--color-primary-light); }
.generating-hint { text-align: center; padding: 12px 0; }
.generating-hint p { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
</style>
