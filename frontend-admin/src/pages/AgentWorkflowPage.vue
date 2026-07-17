<template>
  <div class="workflow-page">
    <GlassCard title="多智能体协同分析" subtitle="Monitor(监控) → Analyze(分析) → Track(追踪) → Report(报告)">
      <template #extra>
        <el-button :icon="Refresh" :loading="loading" @click="loadHistory">刷新</el-button>
      </template>

      <div class="workflow-intro">
        <div class="workflow-steps">
          <div class="step" v-for="(step, i) in workflowSteps" :key="step.name" :class="stepClass(i)">
            <div class="step-icon">{{ step.icon }}</div>
            <div class="step-info">
              <div class="step-name">{{ step.name }}</div>
              <div class="step-desc">{{ step.desc }}</div>
            </div>
            <div v-if="i < workflowSteps.length - 1" class="step-arrow">→</div>
          </div>
        </div>
      </div>

      <div class="input-area">
        <div class="input-label">一句话舆情分析</div>
        <el-input
          v-model="query"
          type="textarea"
          :rows="3"
          placeholder="输入分析需求，例如：帮我分析一下最近一周关于华为Mate 70的舆情"
          :disabled="running"
        />
        <div class="input-actions">
          <el-button type="primary" :loading="running" :disabled="!query.trim()" @click="startAnalysis">
            {{ running ? '分析中...' : '开始分析' }}
          </el-button>
        </div>
      </div>

      <div v-if="running" class="progress-area">
        <div class="progress-steps">
          <div
            v-for="step in progressSteps"
            :key="step.key"
            class="progress-step"
            :class="{ active: step.key === currentStage, done: currentStageIndex > stepIndex(step.key), failed: currentStage === 'failed' }"
          >
            <div class="progress-step-icon">
              <el-icon v-if="currentStageIndex > stepIndex(step.key)"><SuccessFilled /></el-icon>
              <el-icon v-else-if="step.key === currentStage"><Loading /></el-icon>
              <span v-else class="step-num">{{ stepIndex(step.key) + 1 }}</span>
            </div>
            <div class="progress-step-label">{{ step.label }}</div>
          </div>
        </div>
        <div class="progress-message">{{ progressMessage }}</div>
        <el-progress :percentage="progressPercent" :stroke-width="6" :status="currentStage === 'failed' ? 'exception' : 'success'" />
      </div>

      <div v-if="result" class="result-area">
        <div class="result-header">
          <div class="result-title">{{ result.title }}</div>
          <div class="result-meta">
            <span>模型: <code>{{ result.modelUsed }}</code></span>
            <span> · {{ result.tokensUsed }} tokens</span>
          </div>
        </div>
        <div class="result-content render-markdown" v-html="renderMarkdown(result.strategy || result.analysis || '')" />
      </div>
    </GlassCard>

    <GlassCard title="历史分析记录" subtitle="最近的分析请求">
      <div v-if="loadingHistory" class="loading-area"><el-skeleton :rows="3" animated /></div>
      <div v-else-if="history.length > 0" class="history-list">
        <div
          v-for="h in history"
          :key="h.id"
          class="history-item"
          @click="viewHistory(h)"
        >
          <div class="history-item__head">
            <div class="history-item__query">{{ h.inputSnapshot || '无查询' }}</div>
            <el-tag
              :type="h.status === 'completed' ? 'success' : h.status === 'failed' ? 'danger' : 'warning'"
              size="small"
            >
              {{ h.status === 'completed' ? '已完成' : h.status === 'generating' ? '生成中' : h.status === 'failed' ? '失败' : '待处理' }}
            </el-tag>
          </div>
          <div class="history-item__meta">
            <span>{{ formatDate(h.createdAt) }}</span>
            <span v-if="h.modelUsed"> · {{ h.modelUsed }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <el-empty description="暂无分析记录" />
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AgentWorkflowPage' });
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, SuccessFilled, Loading } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const query = ref('');
const running = ref(false);
const currentStage = ref<string>('');
const progressPercent = ref(0);
const progressMessage = ref('');
const result = ref<any>(null);
const loading = ref(false);
const loadingHistory = ref(false);
const history = ref<any[]>([]);

const workflowSteps = [
  { name: 'Monitor', desc: '监控搜索舆情事件', icon: 'M' },
  { name: 'Analyze', desc: '智能分析事件数据', icon: 'A' },
  { name: 'Track', desc: '追踪跨平台传播', icon: 'T' },
  { name: 'Report', desc: '生成综合公关报告', icon: 'R' },
];

const progressSteps = [
  { key: 'understand', label: '理解需求' },
  { key: 'monitor', label: '搜索事件' },
  { key: 'analyze', label: '分析数据' },
  { key: 'track', label: '追踪传播' },
  { key: 'report', label: '生成报告' },
];

const stageOrder = ['understand', 'monitor', 'analyze', 'track', 'report', 'done'];

const currentStageIndex = computed(() => {
  const idx = stageOrder.indexOf(currentStage.value);
  return idx >= 0 ? idx : -1;
});

function stepIndex(key: string): number {
  return progressSteps.findIndex((s) => s.key === key);
}

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function stepClass(i: number): string {
  return '';
}

function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(.|\n)+?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

async function startAnalysis() {
  if (!query.value.trim()) return;
  running.value = true;
  result.value = null;
  currentStage.value = 'understand';
  progressPercent.value = 0;

  try {
    const response = await fetch('/api/agents/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
      },
      body: JSON.stringify({ query: query.value.trim() }),
    });

    if (!response.ok) {
      throw new Error('请求失败');
    }

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
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          try {
            const data = JSON.parse(dataStr);
            if (data.stage) {
              currentStage.value = data.stage;
              progressPercent.value = data.progress || 0;
              progressMessage.value = data.message || '';
            }
            if (data.analysis || data.strategy) {
              result.value = data;
            }
            if (data.reportId) {
              result.value = { ...(result.value || {}), reportId: data.reportId };
            }
          } catch {}
        }
      }
    }

    ElMessage.success('分析完成');
    await loadHistory();
  } catch (err: any) {
    currentStage.value = 'failed';
    ElMessage.error(err?.message || '分析失败');
  } finally {
    running.value = false;
  }
}

async function loadHistory() {
  loadingHistory.value = true;
  try {
    const res = await http.get('/pr/reports', { params: { page: 1, pageSize: 20 } });
    history.value = res.items || [];
  } catch {
    history.value = [];
  } finally {
    loadingHistory.value = false;
  }
}

function viewHistory(h: any) {
  if (h.status === 'completed') {
    result.value = h;
  }
}

onMounted(() => {
  loadHistory();
});
</script>

<style scoped>
.workflow-page { display: flex; flex-direction: column; gap: 20px; }
.workflow-intro { margin-bottom: 16px; }
.workflow-steps { display: flex; align-items: flex-start; gap: 8px; padding: 16px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border); }
.step { display: flex; align-items: center; gap: 8px; flex: 1; }
.step-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.step-info { flex: 1; }
.step-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.step-desc { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.step-arrow { color: var(--text-tertiary); font-size: 18px; margin: 0 4px; }
.input-area { margin-bottom: 16px; }
.input-label { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.input-actions { margin-top: 12px; display: flex; gap: 8px; }
.progress-area { padding: 16px; background: var(--glass-bg); border-radius: var(--radius-md); margin-bottom: 16px; }
.progress-steps { display: flex; gap: 0; margin-bottom: 16px; position: relative; }
.progress-step { display: flex; align-items: center; gap: 8px; flex: 1; }
.progress-step-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; background: var(--el-fill-color-lighter); color: var(--text-tertiary); }
.progress-step.active .progress-step-icon { background: var(--color-primary); color: #fff; }
.progress-step.done .progress-step-icon { background: var(--el-color-success); color: #fff; }
.progress-step.failed .progress-step-icon { background: var(--el-color-danger); color: #fff; }
.progress-step-label { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }
.progress-step.active .progress-step-label { color: var(--color-primary); font-weight: 600; }
.progress-step.done .progress-step-label { color: var(--el-color-success); }
.step-num { font-size: 12px; font-weight: 600; }
.progress-message { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; text-align: center; }
.result-area { margin-top: 16px; }
.result-header { margin-bottom: 12px; }
.result-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
.result-meta { font-size: 12px; color: var(--text-tertiary); }
.result-content { line-height: 1.8; color: var(--text-primary); font-size: 14px; }
.result-content :deep(h2),
.result-content :deep(h3),
.result-content :deep(h4) { margin: 16px 0 8px; }
.result-content :deep(ul) { padding-left: 20px; }
.result-content :deep(li) { margin: 4px 0; }
.loading-area { padding: 20px; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item { padding: 12px 16px; background: var(--glass-bg); border-radius: var(--radius-sm); border: 1px solid var(--glass-border); cursor: pointer; }
.history-item:hover { border-color: var(--color-primary-dark); }
.history-item__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
.history-item__query { font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.history-item__meta { font-size: 12px; color: var(--text-tertiary); }
.empty-state { margin: 20px 0; }
</style>
