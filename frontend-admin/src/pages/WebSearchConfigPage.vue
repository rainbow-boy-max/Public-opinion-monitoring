<template>
  <GlassCard
    title="Web 搜索配置"
    icon="🌐"
    subtitle="AI 智能体能力「联网搜索」需要外部搜索服务；本期支持 9 个国内外 Provider"
  >
    <template #extra>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      <el-button :loading="testing" :disabled="!config?.isEnabled" @click="onTest">
        实时测试
      </el-button>
      <el-button link @click="loadConfig" :loading="loading">刷新</el-button>
    </template>

    <el-form :model="form" label-width="140px" style="max-width: 720px">
      <el-form-item label="启用 Web 搜索">
        <el-switch v-model="form.isEnabled" />
        <span style="margin-left: 12px; color: var(--text-tertiary)">
          关闭时所有智能体的 webSearch 能力降级为声明级，返回 WEB_SEARCH_DISABLED 警告
        </span>
      </el-form-item>

      <el-form-item label="Provider">
        <el-select v-model="form.provider" style="width: 100%">
          <el-option
            v-for="p in config?.providers || []"
            :key="p.value"
            :value="p.value"
            :label="`${p.label}${p.builtin ? '（免 key）' : ''}${p.requiresKey ? ' · 需要 API Key' : ''}`"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="showApiKey" label="API Key">
        <el-input
          v-model="form.apiKey"
          show-password
          :placeholder="currentGuide.apiKeyPlaceholder"
        />
        <div class="form-tip">
          <span v-if="config?.apiKeyMasked">当前已配置（掩码 {{ config.apiKeyMasked }}）</span>
          <span v-else style="color: var(--color-danger)">当前未配置</span>
        </div>
      </el-form-item>

      <el-form-item label="使用说明">
        <el-card shadow="never" class="guide-card">
          <div class="guide-row">
            <div class="guide-label">📦 {{ currentGuide.label }}</div>
            <el-tag
              v-if="currentGuide.builtin"
              type="success"
              size="small"
              effect="dark"
            >免 key</el-tag>
            <el-tag
              v-else-if="currentGuide.requiresKey"
              type="warning"
              size="small"
              effect="dark"
            >需要 API Key</el-tag>
            <el-link
              v-if="currentGuide.howToUrl"
              :href="currentGuide.howToUrl"
              type="primary"
              target="_blank"
              rel="noopener"
              style="margin-left: auto"
            >{{ currentGuide.howToLabel }} ↗</el-link>
          </div>
          <div class="guide-hint">
            <strong>Key 位置：</strong>{{ currentGuide.apiKeyHint }}
          </div>
          <div v-if="currentGuide.baseUrlHint" class="guide-hint">
            <strong>Base URL：</strong><code>{{ currentGuide.baseUrlHint }}</code>
          </div>
          <div v-if="currentGuide.notes" class="guide-hint">
            <strong>备注：</strong>{{ currentGuide.notes }}
          </div>
        </el-card>
      </el-form-item>

      <el-form-item label="最大结果数">
        <el-input-number v-model="form.maxResults" :min="1" :max="10" />
      </el-form-item>
    </el-form>

    <el-divider>实时测试日志</el-divider>

    <div class="test-bar">
      <span class="muted">
        <template v-if="testing">
          <el-icon class="is-loading"><Loading /></el-icon>
          连接中... 实时步骤如下
        </template>
        <template v-else-if="done">
          已完成 · 总耗时
          <strong>{{ totalDurationMs }}ms</strong> ·
          共 <strong>{{ items.length }}</strong> 条结果
          <template v-if="errorMessage"> · <span style="color: var(--color-danger)">{{ errorMessage }}</span></template>
        </template>
        <template v-else>
          尚未运行；点击「实时测试」选择查询并启动
        </template>
      </span>
    </div>

    <el-input
      v-model="queryDraft"
      placeholder="输入查询关键字，例如：openai gpt-4o 价格"
      style="max-width: 480px; margin-bottom: 12px"
      :disabled="testing"
    >
      <template #prefix><span>🔍</span></template>
    </el-input>

    <el-timeline v-if="steps.length > 0">
      <el-timeline-item
        v-for="(s, idx) in steps"
        :key="idx"
        :timestamp="formatTimestamp(s.ts)"
        :type="stepType(s)"
        :hollow="!s.level || s.level === 'info'"
      >
        <strong style="margin-right: 6px">[{{ s.phase }}]</strong>
        {{ s.message }}
        <span v-if="s.durationMs !== undefined" style="margin-left: 6px; color: var(--text-tertiary)"
          >{{ s.durationMs }}ms</span
        >
      </el-timeline-item>
      <el-timeline-item
        v-if="items.length > 0"
        :timestamp="resultsLabel"
        type="primary"
      >
        <div v-for="(r, i) in items" :key="i" class="result-item">
          <a v-if="r.url" :href="r.url" target="_blank" rel="noopener">{{ r.title || '(no title)' }}</a>
          <span v-else>{{ r.title || '(no title)' }}</span>
          <div class="snippet">{{ r.snippet }}</div>
        </div>
      </el-timeline-item>
    </el-timeline>

    <div v-else class="muted" style="text-align: center; padding: 16px">
      暂无日志。点击「实时测试」启动一次 SSE 流。
    </div>
  </GlassCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import { useWebSearchTest, type WebSearchLogStep } from '@/composables/useWebSearchTest';
import { WEB_SEARCH_PROVIDER_GUIDES } from '@/utils/web-search-guides';

defineOptions({ name: 'WebSearchConfigPage' });

interface ProviderEntry {
  value: string;
  label: string;
  requiresKey: boolean;
  builtin: boolean;
}

interface ConfigResp {
  provider: string;
  maxResults: number;
  isEnabled: boolean;
  apiKeyMasked: string;
  providers: ProviderEntry[];
  updatedAt: string | null;
}

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const config = ref<ConfigResp | null>(null);

const form = ref({
  provider: 'duckduckgo',
  apiKey: '',
  maxResults: 5,
  isEnabled: false,
});

const showApiKey = computed(() => {
  const p = config.value?.providers.find((x) => x.value === form.value.provider);
  return !!p && p.requiresKey;
});

const currentGuide = computed(() => {
  return (
    WEB_SEARCH_PROVIDER_GUIDES[form.value.provider] || {
      value: form.value.provider,
      label: form.value.provider,
      builtin: false,
      requiresKey: false,
      apiKeyPlaceholder: '',
      apiKeyHint: '',
      howToUrl: '',
      howToLabel: '',
    }
  );
});

const queryDraft = ref('openai gpt-4o');

const { steps, items, done, errorMessage, totalDurationMs, runTest } = useWebSearchTest();

const resultsLabel = computed(() => `共 ${items.value.length} 条结果`);

function stepType(s: WebSearchLogStep): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (s.level === 'error' || s.phase === 'error') return 'danger';
  if (s.level === 'warn') return 'warning';
  if (s.phase === 'result') return 'success';
  if (s.phase === 'validate') return 'primary';
  return 'info';
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

async function loadConfig(): Promise<void> {
  loading.value = true;
  try {
    const r = (await http.get('/admin/web-search/config')) as ConfigResp;
    config.value = r;
    form.value = {
      provider: r.provider,
      apiKey: '',
      maxResults: r.maxResults,
      isEnabled: r.isEnabled,
    };
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      provider: form.value.provider,
      maxResults: form.value.maxResults,
      isEnabled: form.value.isEnabled,
    };
    if (form.value.apiKey) payload.apiKey = form.value.apiKey;
    const r = await http.put('/admin/web-search/config', payload);
    ElMessage.success('已保存');
    form.value.apiKey = '';
    await loadConfig();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTest(): Promise<void> {
  if (!queryDraft.value.trim()) {
    ElMessage.warning('请输入查询关键字');
    return;
  }
  testing.value = true;
  try {
    let q = queryDraft.value;
    try {
      const r = await ElMessageBox.prompt(
        '确认查询关键字：',
        '执行实时测试',
        {
          inputValue: queryDraft.value,
          inputPlaceholder: '例如：openai gpt-4o',
        },
      );
      q = r.value || q;
    } catch {
      q = queryDraft.value;
    }
    queryDraft.value = q;
    const handle = runTest(q, { provider: form.value.provider });
    const result = await handle.promise;
    if (result.ok && result.items.length > 0) {
      ElMessage.success(`成功 · ${result.items.length} 条 · ${result.totalDurationMs}ms`);
    } else if (result.ok) {
      ElMessage.warning('成功但无结果，请换关键词');
    } else {
      ElMessage.error(result.errorMessage || '测试失败');
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '测试失败');
  } finally {
    testing.value = false;
  }
}

watch(
  () => form.value.provider,
  () => {
    form.value.apiKey = '';
  },
);

onMounted(loadConfig);
</script>

<style scoped>
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.muted {
  color: var(--text-tertiary);
  font-size: 12px;
}

.test-bar {
  margin-bottom: 12px;
}

.guide-card {
  background: rgba(94, 114, 228, 0.06);
  border: 1px solid var(--border-subtle);
}

.guide-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.guide-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-hint {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 4px;
}

.guide-hint code {
  background: rgba(94, 114, 228, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 11px;
}

.result-item {
  margin: 8px 0;
}

.result-item a {
  color: var(--color-primary-light);
  font-weight: 500;
}

.result-item .snippet {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  margin-top: 2px;
}
</style>
