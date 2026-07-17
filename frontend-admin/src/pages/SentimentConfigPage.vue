<template>
  <div class="sentiment-page">
    <GlassCard title="情感分析配置" subtitle="舆情情感分析引擎设置与测试">
      <template #extra>
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
      </template>

      <el-form :model="config" label-width="160px" style="max-width: 600px">
        <el-form-item label="分析方法">
          <el-radio-group v-model="config.method">
            <el-radio value="rule">规则分析</el-radio>
            <el-radio value="llm">LLM增强分析</el-radio>
            <el-radio value="dual">双通道（推荐）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="LLM模型">
          <el-select v-model="config.modelId" filterable style="width: 100%" placeholder="选择LLM模型（双通道/LLM模式必选）">
            <el-option-group v-for="g in groupedModels" :key="g.provider" :label="g.provider">
              <el-option v-for="m in g.models" :key="m.id" :value="m.id" :label="`${m.displayName} (${m.model})`" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="双通道阈值">
          <el-slider v-model="config.dualThreshold" :min="0" :max="1" :step="0.05" style="width: 280px" />
          <span style="margin-left: 12px; color: var(--text-tertiary)">规则置信度低于此值时触发LLM分析</span>
        </el-form-item>
        <el-divider />
        <div class="config-section-title">负面识别增强</div>
        <el-form-item label="讽刺检测">
          <el-switch v-model="config.sarcasmDetection" active-text="开启" inactive-text="关闭" />
          <span style="margin-left: 12px; color: var(--text-tertiary)">识别讽刺、反语、隐喻等复杂表达</span>
        </el-form-item>
        <el-form-item label="上下文窗口">
          <el-radio-group v-model="config.contextWindowSize">
            <el-radio-button :value="1">1 句</el-radio-button>
            <el-radio-button :value="3">3 句（推荐）</el-radio-button>
            <el-radio-button :value="5">5 句</el-radio-button>
          </el-radio-group>
          <span style="margin-left: 12px; color: var(--text-tertiary)">分析单条文本时参考的上下文句数</span>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="情感分析测试" style="margin-top: 16px">
      <el-input
        v-model="testText"
        type="textarea"
        :rows="4"
        placeholder="输入要分析的文本..."
        style="margin-bottom: 12px"
      />
      <el-button type="primary" :loading="testing" @click="onTest">分析</el-button>

      <div v-if="testResult" class="test-result">
        <el-divider />
        <div class="result-grid">
          <div class="result-item">
            <span class="label">情感</span>
            <el-tag :type="sentimentType(testResult.sentiment)" size="large">
              {{ sentimentLabel(testResult.sentiment) }}
            </el-tag>
          </div>
          <div class="result-item">
            <span class="label">分数</span>
            <span :style="{ color: testResult.score > 0 ? 'var(--color-success)' : testResult.score < 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }">
              {{ testResult.score.toFixed(3) }}
            </span>
          </div>
          <div class="result-item">
            <span class="label">置信度</span>
            <span>{{ (testResult.confidence * 100).toFixed(1) }}%</span>
          </div>
          <div class="result-item">
            <span class="label">来源</span>
            <el-tag>{{ sourceLabel(testResult.source) }}</el-tag>
          </div>
          <div v-if="testResult.isSarcastic !== undefined" class="result-item">
            <span class="label">讽刺检测</span>
            <el-tag :type="testResult.isSarcastic ? 'danger' : 'info'">{{ testResult.isSarcastic ? '检测到讽刺' : '未检测到讽刺' }}</el-tag>
          </div>
        </div>
        <div v-if="testResult.reasoning" class="reasoning">
          <span class="label">分析理由：</span>{{ testResult.reasoning }}
        </div>
        <div v-if="testResult.aspects && testResult.aspects.length > 0" class="aspects">
          <span class="label">方面分析：</span>
          <div v-for="(a, i) in testResult.aspects" :key="i" class="aspect-item">
            <span>{{ a.aspect }}：</span>
            <el-tag :type="sentimentType(a.sentiment)" size="small">{{ sentimentLabel(a.sentiment) }}</el-tag>
            <span style="margin-left: 8px">分数：{{ a.score.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </GlassCard>

    <GlassCard title="讽刺文本测试" style="margin-top: 16px">
      <el-input
        v-model="sarcasmTestText"
        type="textarea"
        :rows="4"
        placeholder="输入可能的讽刺/反语文本..."
        style="margin-bottom: 12px"
      />
      <div class="sarcasm-hints">
        <el-tag v-for="(hint, i) in sarcasmHints" :key="i" size="small" style="cursor: pointer; margin: 0 4px 4px 0" @click="sarcasmTestText = hint">{{ hint }}</el-tag>
      </div>
      <el-button type="warning" :loading="sarcasmTesting" @click="onSarcasmTest">检测讽刺</el-button>

      <div v-if="sarcasmResult" class="test-result">
        <el-divider />
        <div class="result-grid">
          <div class="result-item">
            <span class="label">情感</span>
            <el-tag :type="sentimentType(sarcasmResult.sentiment)" size="large">{{ sentimentLabel(sarcasmResult.sentiment) }}</el-tag>
          </div>
          <div class="result-item">
            <span class="label">分数</span>
            <span :style="{ color: sarcasmResult.score > 0 ? 'var(--color-success)' : sarcasmResult.score < 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }">
              {{ sarcasmResult.score.toFixed(3) }}
            </span>
          </div>
          <div class="result-item">
            <span class="label">讽刺检测</span>
            <el-tag :type="sarcasmResult.isSarcastic ? 'danger' : 'info'">
              {{ sarcasmResult.isSarcastic ? '是' : '否' }}
            </el-tag>
          </div>
          <div class="result-item">
            <span class="label">置信度</span>
            <span>{{ (sarcasmResult.confidence * 100).toFixed(1) }}%</span>
          </div>
        </div>
        <div v-if="sarcasmResult.reasoning" class="reasoning">
          <span class="label">分析理由：</span>{{ sarcasmResult.reasoning }}
        </div>
      </div>
    </GlassCard>

    <GlassCard title="批量重分析" style="margin-top: 16px">
      <el-form :model="batchForm" label-width="160px">
        <el-form-item label="任务ID">
          <el-input-number v-model="batchForm.taskId" :min="1" style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="reanalyzing" @click="onReanalyzeTask">
            重分析该任务所有事件
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="batchResult" class="batch-result">
        <el-alert
          :title="`已完成：${batchResult.updated} / ${batchResult.total} 条`"
          :type="batchResult.updated === batchResult.total ? 'success' : 'warning'"
          show-icon
        />
      </div>
    </GlassCard>

    <GlassCard title="统计概览" style="margin-top: 16px">
      <div v-if="stats" class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalAnalyzed }}</div>
          <div class="stat-label">已分析事件</div>
        </div>
        <div class="stat-card stat-positive">
          <div class="stat-value">{{ stats.positive }}</div>
          <div class="stat-label">正面</div>
        </div>
        <div class="stat-card stat-negative">
          <div class="stat-value">{{ stats.negative }}</div>
          <div class="stat-label">负面</div>
        </div>
        <div class="stat-card stat-neutral">
          <div class="stat-value">{{ stats.neutral }}</div>
          <div class="stat-label">中性</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ (stats.avgConfidence * 100).toFixed(1) }}%</div>
          <div class="stat-label">平均置信度</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.sarcasmDetected ?? '-' }}</div>
          <div class="stat-label">检测到讽刺</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.sarcasmEnabled ? '开启' : '关闭' }}</div>
          <div class="stat-label">讽刺检测</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.contextWindowSize ?? '-' }}</div>
          <div class="stat-label">上下文窗口</div>
        </div>
      </div>
      <div v-if="stats && Object.keys(stats.sourceDistribution).length > 0" class="source-dist">
        <el-divider />
        <span class="label">分析来源分布：</span>
        <div v-for="(count, source) in stats.sourceDistribution" :key="source" class="source-item">
          <el-tag>{{ sourceLabel(source) }}：{{ count }}</el-tag>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

defineOptions({ name: 'SentimentConfigPage' });

interface LlmModel {
  id: number;
  provider: string;
  model: string;
  displayName: string;
  isEnabled: boolean;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  aspects?: Array<{ aspect: string; sentiment: string; score: number }>;
  reasoning?: string;
  source: 'rule' | 'llm' | 'merged';
}

const models = ref<LlmModel[]>([]);
const saving = ref(false);
const testing = ref(false);
const reanalyzing = ref(false);
const sarcasmTesting = ref(false);
const testText = ref('');
const sarcasmTestText = ref('');
const testResult = ref<SentimentResult | null>(null);
const sarcasmResult = ref<SentimentResult | null>(null);
const batchResult = ref<{ total: number; updated: number } | null>(null);
const stats = ref<{
  totalAnalyzed: number;
  positive: number;
  negative: number;
  neutral: number;
  avgConfidence: number;
  sourceDistribution: Record<string, number>;
  sarcasmDetected?: number;
  sarcasmEnabled?: boolean;
  contextWindowSize?: number;
} | null>(null);

const config = reactive({
  method: 'dual',
  modelId: 0,
  dualThreshold: 0.7,
  sarcasmDetection: true,
  contextWindowSize: 3,
});

const sarcasmHints = [
  '这产品质量真好，用了三天就坏了',
  '太厉害了，这种操作都能想出来',
  '某某品牌，你真棒，售后服务太到位了',
  '太棒了，又涨价了，真是良心企业',
  '这个方案真"完美"，每个环节都有惊喜',
];

const batchForm = reactive({
  taskId: 1,
});

const groupedModels = computed(() => {
  const g: Record<string, LlmModel[]> = {};
  for (const m of models.value) {
    if (!m.isEnabled) continue;
    if (!g[m.provider]) g[m.provider] = [];
    g[m.provider].push(m);
  }
  return Object.entries(g).map(([provider, ms]) => ({ provider, models: ms }));
});

function sentimentType(s: string): 'success' | 'danger' | 'info' {
  if (s === 'positive') return 'success';
  if (s === 'negative') return 'danger';
  return 'info';
}

function sentimentLabel(s: string): string {
  if (s === 'positive') return '正面';
  if (s === 'negative') return '负面';
  return '中性';
}

function sourceLabel(s: string): string {
  if (s === 'rule') return '规则分析';
  if (s === 'llm') return 'LLM分析';
  if (s === 'merged') return '双通道融合';
  return s;
}

async function loadModels(): Promise<void> {
  try {
    const r: any = await http.get('/llm-models?pageSize=100');
    models.value = (r.items || []).filter((m: LlmModel) => m.isEnabled);
  } catch { /* ignore */ }
}

async function loadStats(): Promise<void> {
  try {
    const r: any = await http.get('/sentiment/stats');
    stats.value = r.data;
  } catch { /* ignore */ }
}

async function loadConfig(): Promise<void> {
  try {
    const r: any = await http.get('/sentiment/config');
    config.method = r.data.method;
    config.modelId = r.data.modelId;
    config.dualThreshold = r.data.dualThreshold;
    config.sarcasmDetection = r.data.sarcasmDetection;
    config.contextWindowSize = r.data.contextWindowSize;
  } catch { /* ignore */ }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    await http.post('/sentiment/config', config);
    ElMessage.success('配置已保存');
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTest(): Promise<void> {
  if (!testText.value.trim()) {
    ElMessage.warning('请输入要分析的文本');
    return;
  }
  testing.value = true;
  try {
    const r: any = await http.post('/sentiment/analyze', {
      text: testText.value,
      detailed: true,
    });
    testResult.value = r.data;
  } catch (err: any) {
    ElMessage.error(err?.message || '分析失败');
  } finally {
    testing.value = false;
  }
}

async function onSarcasmTest(): Promise<void> {
  if (!sarcasmTestText.value.trim()) {
    ElMessage.warning('请输入要检测的文本');
    return;
  }
  sarcasmTesting.value = true;
  try {
    const r: any = await http.post('/sentiment/analyze', {
      text: sarcasmTestText.value,
      detailed: true,
    });
    sarcasmResult.value = r.data;
  } catch (err: any) {
    ElMessage.error(err?.message || '分析失败');
  } finally {
    sarcasmTesting.value = false;
  }
}

async function onReanalyzeTask(): Promise<void> {
  reanalyzing.value = true;
  batchResult.value = null;
  try {
    const r: any = await http.post('/sentiment/reanalyze-task', { taskId: batchForm.taskId });
    batchResult.value = r.data;
    ElMessage.success(`重分析完成：${r.data.updated} / ${r.data.total}`);
    await loadStats();
  } catch (err: any) {
    ElMessage.error(err?.message || '重分析失败');
  } finally {
    reanalyzing.value = false;
  }
}

onMounted(() => {
  loadModels();
  loadStats();
  loadConfig();
});
</script>

<style scoped>
.sentiment-page {
  max-width: 900px;
  margin: 0 auto;
}

.test-result {
  margin-top: 8px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 12px 0;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.reasoning,
.aspects {
  margin-top: 8px;
}

.aspect-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 4px 8px 4px 0;
  padding: 4px 10px;
  background: var(--glass-bg);
  border-radius: var(--radius-sm);
}

.batch-result {
  margin-top: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.sarcasm-hints {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
}

.config-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  padding: 0 0 8px;
  margin: 0 0 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.stat-card {
  text-align: center;
  padding: 16px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.stat-positive .stat-value { color: var(--color-success); }
.stat-negative .stat-value { color: var(--color-danger); }
.stat-neutral .stat-value { color: var(--text-secondary); }

.source-dist {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
</style>
