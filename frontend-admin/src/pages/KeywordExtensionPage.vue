<template>
  <GlassCard title="关键词智能扩展" icon="🧠" subtitle="AI 驱动的 SEO 关键词拓展与推荐">
    <div class="kw-extension">
      <div class="section">
        <label class="section-label">种子关键词</label>
        <el-input
          v-model="keywordsText"
          type="textarea"
          :rows="2"
          placeholder="输入种子关键词，多个词用逗号或换行分隔"
        />
      </div>

      <div class="section">
        <label class="section-label">推荐数量: {{ keywordCount }}</label>
        <el-slider v-model="keywordCount" :min="5" :max="20" :step="1" show-stops />
      </div>

      <div class="section">
        <el-button type="primary" :loading="loading" :disabled="!hasKeywords" @click="doSuggest">
          智能扩展
        </el-button>
        <el-button v-if="results.length > 0" @click="copyAll">复制全部</el-button>
      </div>

      <div v-if="error" class="error-msg">
        <el-alert v-if="error === 'LLM_NOT_CONFIGURED'" title="LLM 未配置" type="warning" show-icon :description="'请先在 LLM 模型管理页面配置并启用至少一个模型'" closable />
        <el-alert v-else :title="'扩展失败'" type="error" show-icon :description="error" closable />
      </div>

      <div v-if="results.length > 0" class="section">
        <label class="section-label">推荐关键词 ({{ results.length }})</label>
        <div class="card-grid">
          <div
            v-for="item in results"
            :key="item.word"
            class="kw-card"
            :class="{ 'kw-card--selected': selectedWords.includes(item.word) }"
            @click="toggleSelect(item.word)"
          >
            <div class="kw-card__head">
              <span class="kw-card__word">{{ item.word }}</span>
              <el-tag :type="badgeType(item.type)" size="small" effect="dark">
                {{ typeLabel(item.type) }}
              </el-tag>
            </div>
            <div class="kw-card__score-row">
              <span class="kw-card__score-label">相关度</span>
              <el-progress :percentage="item.score" :stroke-width="8" :color="scoreColor(item.score)" />
            </div>
            <div class="kw-card__reason" :title="item.reason">
              {{ item.reason }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedWords.length > 0" class="section selected-section">
        <label class="section-label">已选关键词 ({{ selectedWords.length }})</label>
        <div class="selected-list">
          <el-tag
            v-for="w in selectedWords"
            :key="w"
            closable
            type="primary"
            @close="removeSelected(w)"
          >
            {{ w }}
          </el-tag>
        </div>
        <div class="selected-actions">
          <el-button type="primary" @click="copySelected">复制已选</el-button>
          <el-button @click="selectedWords = []">清空</el-button>
        </div>
      </div>
    </div>
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

interface KeywordItem {
  word: string;
  type: 'synonym' | 'broader' | 'narrower' | 'related';
  score: number;
  reason: string;
}

const keywordsText = ref('');
const keywordCount = ref(10);
const loading = ref(false);
const results = ref<KeywordItem[]>([]);
const error = ref('');
const selectedWords = ref<string[]>([]);

const hasKeywords = computed(() => {
  return parseKeywords().length > 0;
});

function parseKeywords(): string[] {
  return keywordsText.value
    .split(/[,\n;，；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function badgeType(t: string): 'success' | 'warning' | 'info' | 'primary' {
  return ({ synonym: 'success', broader: 'warning', narrower: 'info', related: 'primary' } as any)[t] || 'info';
}

function typeLabel(t: string): string {
  return ({ synonym: '同义词', broader: '上位词', narrower: '下位词', related: '相关词' } as any)[t] || t;
}

function scoreColor(s: number): string {
  if (s >= 80) return '#67C23A';
  if (s >= 50) return '#E6A23C';
  return '#909399';
}

async function doSuggest(): Promise<void> {
  const keywords = parseKeywords();
  if (keywords.length === 0) {
    ElMessage.warning('请输入至少一个种子关键词');
    return;
  }
  loading.value = true;
  error.value = '';
  results.value = [];
  try {
    const res = await http.post('/keywords/suggest', {
      keywords,
      count: keywordCount.value,
    });
    results.value = res.keywords || [];
    if (res.error) {
      error.value = res.error;
    }
  } catch (err: any) {
    error.value = err?.message || '请求失败';
  } finally {
    loading.value = false;
  }
}

function toggleSelect(word: string): void {
  const idx = selectedWords.value.indexOf(word);
  if (idx >= 0) {
    selectedWords.value.splice(idx, 1);
  } else {
    selectedWords.value.push(word);
  }
}

function removeSelected(word: string): void {
  const idx = selectedWords.value.indexOf(word);
  if (idx >= 0) selectedWords.value.splice(idx, 1);
}

async function copyAll(): Promise<void> {
  const text = results.value.map((r) => r.word).join(', ');
  await navigator.clipboard.writeText(text);
  ElMessage.success(`已复制 ${results.value.length} 个关键词`);
}

async function copySelected(): Promise<void> {
  const text = selectedWords.value.join(', ');
  await navigator.clipboard.writeText(text);
  ElMessage.success(`已复制 ${selectedWords.value.length} 个关键词`);
}
</script>

<style scoped>
.kw-extension {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.kw-card {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kw-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(94, 114, 228, 0.2);
}

.kw-card--selected {
  border-color: var(--color-primary);
  background: rgba(94, 114, 228, 0.08);
}

.kw-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kw-card__word {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.kw-card__score-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kw-card__score-label {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.kw-card__reason {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.selected-section {
  border-top: 1px solid var(--border-subtle);
  padding-top: 20px;
}

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.error-msg {
  margin: 8px 0;
}
</style>
