<template>
  <div class="pr-page">
    <GlassCard title="AI 公关方案" icon="🎯" subtitle="舆情报告与周期性分析">
      <template #extra>
        <el-button type="primary" :icon="Plus" @click="openCustomDialog">自定义舆情分析</el-button>
      </template>

      <el-tabs v-model="activeTab" class="pr-tabs">
        <el-tab-pane label="单事件报告" name="single">
          <div v-if="!loading && reports.length === 0" class="empty-state">
            <el-empty description="暂无公关报告">
              <template #image>
                <div class="empty-state-image">
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                </div>
              </template>
              <el-button type="primary" size="large" @click="loadMockReport" class="demo-btn">加载示例报告</el-button>
              <el-button @click="$router.push('/realtime')" style="margin-top: 8px">前往实时大屏</el-button>
            </el-empty>
          </div>

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
              <div class="report-card__actions" @click.stop>
                <el-button
                  v-if="r.status === 'completed'"
                  size="small"
                  text
                  :icon="HeadphoneIcon"
                  :loading="synthesizingReportId === r.id"
                  @click="openVoiceDialog(r)"
                >语音播报</el-button>
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

    <p class="page-guide">使用 AI 生成舆情分析报告、公关应对方案和声明话术</p>

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

    <el-dialog v-model="voiceDialogVisible" title="语音播报" width="480" top="25vh" destroy-on-close>
      <div class="voice-dialog">
        <div class="voice-options">
          <el-select v-model="selectedVoice" placeholder="选择声音" style="width: 100%">
            <el-option
              v-for="v in voices"
              :key="v.id"
              :label="v.name"
              :value="v.id"
            >
              <div class="voice-option">
                <div class="voice-option__name">{{ v.name }}</div>
                <div class="voice-option__meta">
                  <el-tag size="small" :type="v.provider === 'xiaomi' ? 'warning' : 'primary'">
                    {{ v.provider === 'xiaomi' ? '小米' : 'MiniMax' }}
                  </el-tag>
                  <span class="voice-option__desc">{{ v.description }}</span>
                </div>
              </div>
            </el-option>
          </el-select>
        </div>
        <div class="voice-options">
          <el-slider
            v-model="voiceSpeed"
            :min="0.5"
            :max="2.0"
            :step="0.1"
            show-input
            input-size="small"
            style="width: 100%"
          >
            <template #prepend>语速</template>
          </el-slider>
        </div>
        <div class="voice-dialog__actions">
          <el-button type="primary" :loading="synthesizing" @click="startSynthesis">
            {{ currentAudio ? '重新生成' : '开始播报' }}
          </el-button>
        </div>
        <div v-if="synthesisError" class="voice-error">{{ synthesisError }}</div>
        <div v-if="currentAudio" class="voice-player-wrapper">
          <audio
            ref="audioPlayerRef"
            :src="currentAudio"
            controls
            autoplay
            style="width: 100%"
            @ended="onAudioEnded"
          ></audio>
          <div class="voice-player-info">
            时长: {{ formatDuration(currentDuration) }}
          </div>
        </div>
      </div>
    </el-dialog>

    <div v-if="floatingReport" class="floating-player">
      <div class="floating-player__info">
        <div class="floating-player__title">报告 #{{ floatingReport.id }}</div>
        <div class="floating-player__controls">
          <el-button size="small" circle @click="toggleFloatingPlay">
            <span v-if="floatingPlaying">⏸</span>
            <span v-else>▶</span>
          </el-button>
          <el-progress
            :percentage="floatingProgress"
            :stroke-width="4"
            style="width: 200px; margin: 0 12px"
          />
          <span class="floating-player__time">{{ formatDuration(floatingCurrentTime) }} / {{ formatDuration(floatingTotalDuration) }}</span>
        </div>
      </div>
      <el-button size="small" text @click="closeFloatingPlayer">关闭</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download, Headphone as HeadphoneIcon } from '@element-plus/icons-vue';
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

function loadMockReport() {
  reports.value = [{
    id: 1,
    title: '示例：品牌危机公关分析报告',
    eventId: null,
    agentId: null,
    status: 'completed',
    reportType: 'single',
    createdAt: new Date().toISOString(),
    modelUsed: 'DeepSeek-V3',
    tokensUsed: 2856,
    latencyMs: 3420,
    analysis: '## 一、舆情深度分析\n\n事件性质：产品质量负面舆情，涉及食品安全问题。\n当前传播态势：事件已在微博、微信、抖音等多平台传播，微博话题阅读量突破 2 亿，讨论量 15 万+。\n关键情绪词：愤怒、失望、担忧、质疑\n可能蔓延方向：可能从产品问题蔓延至品牌信任危机',
    strategy: '## 二、潜在风险评估\n\n商业风险：高 - 已有电商平台下架相关产品\n品牌风险：中高 - 品牌口碑指数下降 30%\n\n## 三、公关应对方案\n\n### 短期（24小时内）行动：\n1. 立即发布官方声明，表明态度\n2. 成立专项调查组\n3. 启动消费者热线\n\n### 公开声明话术：\n「我们高度重视消费者反馈，已第一时间成立专项工作组进行全面核查。如有任何问题，我们将依法承担相应责任。」',
  }];
  reports.value.push({
    id: 2,
    title: '示例：行业趋势周报',
    eventId: null,
    agentId: null,
    status: 'completed',
    reportType: 'periodic',
    periodicFreq: 'daily',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    modelUsed: 'GPT-4o',
    tokensUsed: 4120,
    latencyMs: 5800,
    analysis: '## 本周舆情综述\n\n本周行业内主要舆情集中在 AI 监管政策、新能源市场竞争格局变化等方面。\n\n### 关键发现\n- AI 相关讨论占比 38%，环比上升 12%\n- 新能源领域关注度持续走高\n- 消费者权益保护话题热度不减',
    strategy: '## 应对建议\n\n建议持续关注 AI 监管政策走向，提前做好合规准备。',
  });
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

// Voice broadcast (P3-06)
const voiceDialogVisible = ref(false);
const synthesizing = ref(false);
const synthesizingReportId = ref<number | null>(null);
const voices = ref<Array<{ id: string; name: string; description: string }>>([]);
const selectedVoice = ref('female-chengshu');
const voiceSpeed = ref(1.0);
const currentAudio = ref('');
const currentDuration = ref(0);
const synthesisError = ref('');
const voiceTargetReport = ref<any>(null);
const audioPlayerRef = ref<HTMLAudioElement | null>(null);

const floatingReport = ref<any>(null);
const floatingPlaying = ref(false);
const floatingProgress = ref(0);
const floatingCurrentTime = ref(0);
const floatingTotalDuration = ref(0);
let floatingAudioEl: HTMLAudioElement | null = null;

const selectedVoiceProvider = computed(() => {
  const v = voices.value.find(v => v.id === selectedVoice.value);
  return v?.provider || 'minimax';
});

async function loadVoices(): Promise<void> {
  try {
    voices.value = await http.get('/tts/voices');
    const defaultVoice = voices.value[0];
    if (defaultVoice) selectedVoice.value = defaultVoice.id;
  } catch (err) {
    console.error(err);
  }
}

function openVoiceDialog(r: any): void {
  voiceTargetReport.value = r;
  currentAudio.value = r.audioUrl || '';
  currentDuration.value = r.audioDurationMs || 0;
  synthesisError.value = '';
  voiceDialogVisible.value = true;
}

async function startSynthesis(): Promise<void> {
  const report = voiceTargetReport.value;
  if (!report) return;
  synthesizing.value = true;
  synthesisError.value = '';
  try {
    const provider = selectedVoiceProvider.value;
    const res = await http.post(`/tts/report/${report.id}`, {
      voiceId: selectedVoice.value,
      speed: voiceSpeed.value,
      provider,
    });
    currentAudio.value = res.audioUrl;
    currentDuration.value = res.durationMs;
    report.audioUrl = res.audioUrl;
    report.audioDurationMs = res.durationMs;
  } catch (err: any) {
    synthesisError.value = err?.message || '语音合成失败';
  } finally {
    synthesizing.value = false;
  }
}

function onAudioEnded(): void {
  // audio ended naturally
}

function formatDuration(ms: number): string {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function openFloatingPlayer(r: any): void {
  if (floatingAudioEl) {
    floatingAudioEl.pause();
    floatingAudioEl = null;
  }
  floatingReport.value = r;
  floatingPlaying.value = true;
  floatingProgress.value = 0;
  floatingCurrentTime.value = 0;
  floatingTotalDuration.value = r.audioDurationMs || 0;

  if (r.audioUrl) {
    floatingAudioEl = new Audio(r.audioUrl);
    floatingAudioEl.play();
    floatingAudioEl.addEventListener('timeupdate', () => {
      if (floatingAudioEl) {
        floatingCurrentTime.value = floatingAudioEl.currentTime * 1000;
        floatingProgress.value = floatingAudioEl.duration
          ? (floatingAudioEl.currentTime / floatingAudioEl.duration) * 100
          : 0;
      }
    });
    floatingAudioEl.addEventListener('ended', () => {
      floatingPlaying.value = false;
    });
  }
}

function toggleFloatingPlay(): void {
  if (!floatingAudioEl) return;
  if (floatingPlaying.value) {
    floatingAudioEl.pause();
    floatingPlaying.value = false;
  } else {
    floatingAudioEl.play();
    floatingPlaying.value = true;
  }
}

function closeFloatingPlayer(): void {
  if (floatingAudioEl) {
    floatingAudioEl.pause();
    floatingAudioEl = null;
  }
  floatingReport.value = null;
  floatingPlaying.value = false;
  floatingProgress.value = 0;
}

onMounted(async () => {
  await loadReports();
  if (reports.value.length === 0) {
    loadMockReport();
  }
  loadAgents();
  loadMonitorTasks();
  loadSchedules();
  loadVoices();
});
void router;
void statusType;
</script>

<style scoped>
.page-guide {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
  margin-bottom: 16px;
  line-height: 1.5;
}
.pr-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state-image {
  opacity: 0.3;
  margin-bottom: 8px;
}

.demo-btn {
  margin-bottom: 8px;
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

.report-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--glass-border);
}

.voice-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.voice-options {
  display: flex;
  align-items: center;
  gap: 12px;
}

.voice-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voice-option__name {
  font-size: 14px;
  font-weight: 500;
}

.voice-option__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.voice-option__desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.voice-option__desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.voice-dialog__actions {
  display: flex;
  justify-content: center;
}

.voice-error {
  color: var(--color-danger);
  font-size: 13px;
  text-align: center;
}

.voice-player-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.voice-player-info {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.floating-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--glass-border);
}

.floating-player__info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.floating-player__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 100px;
}

.floating-player__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.floating-player__time {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}
</style>
