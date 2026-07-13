<template>
  <div class="pr-page">
    <GlassCard title="AI 公关方案" icon="🎯" subtitle="为特定舆情事件生成专业级公关应对方案">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="openCustomDialog">自定义舆情分析</el-button>
      </template>

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
              <div class="report-card__title">报告 #{{ r.id }} · {{ statusLabel(r.status) }}</div>
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
          <el-tag effect="dark" type="success" size="small">
            {{ currentReport.modelUsed }}
          </el-tag>
          <span class="meta-text">{{ currentReport.tokensUsed }} tokens · {{ currentReport.latencyMs }}ms</span>
          <el-button size="small" text @click="onCopyReport(currentReport)">复制结果</el-button>
        </div>
        <section class="report-section">
          <h3>📊 舆情深度分析</h3>
          <markdown-renderer :source="currentReport.analysis || ''" />
        </section>
        <section class="report-section">
          <h3>💡 公关应对方案</h3>
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
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const router = useRouter();
const reports = ref<any[]>([]);
const loading = ref(false);
const reportVisible = ref(false);
const currentReport = ref<any>(null);

const customVisible = ref(false);
const submitting = ref(false);
const customForm = reactive({ title: '', text: '', agentId: 0 });
const agents = ref<any[]>([]);

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
</style>
