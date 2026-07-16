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
          </div>
          <div class="report-card__body">
            <span v-if="r.modelUsed">模型：<code>{{ r.modelUsed }}</code></span>
            <span v-if="r.tokensUsed"> · Tokens：{{ r.tokensUsed }}</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <el-empty description="暂无公关报告">
          <el-button type="primary" size="large" @click="loadMockReport">加载示例报告</el-button>
        </el-empty>
      </div>
    </GlassCard>

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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const reports = ref<any[]>([]);
const reportVisible = ref(false);
const currentReport = ref<any>(null);

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

function openReport(r: any) {
  currentReport.value = r;
  reportVisible.value = true;
}

function openCustomDialog() {
  ElMessage.info('自定义分析功能即将上线');
}

onMounted(() => {
  loadMockReport();
  loadReports();
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
.report-card__head { margin-bottom: 8px; }
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
</style>
