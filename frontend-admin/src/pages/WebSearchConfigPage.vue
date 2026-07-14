<template>
  <GlassCard
    title="Web 搜索配置"
    icon="🌐"
    subtitle="AI 智能体能力「联网搜索」需要外部搜索服务；本期支持 DuckDuckGo（免 key）与 Brave（需 API Key）"
  >
    <template #extra>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      <el-button :loading="testing" @click="onTest">测试</el-button>
    </template>

    <el-form :model="form" label-width="140px" style="max-width: 720px">
      <el-form-item label="启用 Web 搜索">
        <el-switch v-model="form.isEnabled" />
        <span style="margin-left: 12px; color: var(--text-tertiary)">
          关闭时所有智能体的 webSearch 能力将自动降级为声明级，并返回 WEB_SEARCH_DISABLED 警告
        </span>
      </el-form-item>

      <el-form-item label="Provider">
        <el-radio-group v-model="form.provider">
          <el-radio value="duckduckgo">DuckDuckGo（免 key）</el-radio>
          <el-radio value="brave">Brave Search API（需 API Key）</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.provider === 'brave'" label="API Key">
        <el-input
          v-model="form.apiKey"
          show-password
          placeholder="BSA...  留空保持原值"
        />
        <div class="form-tip">在 https://brave.com/search/api/ 申请 Free Tier</div>
      </el-form-item>

      <el-form-item label="最大结果数">
        <el-input-number v-model="form.maxResults" :min="1" :max="10" />
      </el-form-item>
    </el-form>

    <div v-if="testResult.length > 0" class="test-result">
      <el-divider />
      <h4 style="color: var(--text-primary); margin: 0 0 12px">测试结果 ({{ testResult.length }} 条)</h4>
      <ul>
        <li v-for="(r, i) in testResult" :key="i">
          <a v-if="r.url" :href="r.url" target="_blank" rel="noopener">{{ r.title }}</a>
          <span v-else>{{ r.title }}</span>
          <div class="snippet">{{ r.snippet }}</div>
        </li>
      </ul>
    </div>

    <div v-if="testError" class="test-error">
      <el-alert :title="testError" type="error" :closable="false" show-icon />
    </div>
  </GlassCard>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

defineOptions({ name: 'WebSearchConfigPage' });

interface WebSearchConfigResp {
  provider: 'duckduckgo' | 'brave';
  maxResults: number;
  isEnabled: boolean;
  apiKeyMasked: string;
  updatedAt: string | null;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

const form = reactive<{
  provider: 'duckduckgo' | 'brave';
  apiKey: string;
  maxResults: number;
  isEnabled: boolean;
}>({
  provider: 'duckduckgo',
  apiKey: '',
  maxResults: 5,
  isEnabled: false,
});

const saving = ref(false);
const testing = ref(false);
const testResult = ref<SearchResult[]>([]);
const testError = ref('');

async function loadConfig(): Promise<void> {
  try {
    const r = (await http.get('/admin/web-search/config')) as WebSearchConfigResp;
    form.provider = r.provider;
    form.maxResults = r.maxResults;
    form.isEnabled = r.isEnabled;
    form.apiKey = '';
  } catch (err) {
    console.error(err);
  }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      provider: form.provider,
      maxResults: form.maxResults,
      isEnabled: form.isEnabled,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;
    await http.put('/admin/web-search/config', payload);
    ElMessage.success('已保存');
    await loadConfig();
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTest(): Promise<void> {
  testing.value = true;
  testError.value = '';
  testResult.value = [];
  try {
    let q = '';
    try {
      const r = await ElMessageBox.prompt('输入测试查询关键字', '测试 Web 搜索', {
        inputPlaceholder: '例如：deepseek v3',
        inputValue: 'deepseek v3',
      });
      q = r.value;
    } catch {
      q = 'deepseek v3';
    }
    if (!q) q = 'deepseek v3';
    const r = (await http.post('/admin/web-search/test', { query: q })) as {
      ok: boolean;
      count: number;
      items?: SearchResult[];
      errorCode?: string;
      message?: string;
    };
    if (r.ok) {
      testResult.value = r.items || [];
      ElMessage.success(`测试成功，${r.count} 条结果`);
    } else {
      testError.value = `[${r.errorCode}] ${r.message}`;
      ElMessage.warning(testError.value);
    }
  } catch (err: any) {
    testError.value = err?.message || '测试失败';
    ElMessage.error(testError.value);
  } finally {
    testing.value = false;
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.test-result ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.test-result li {
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-subtle);
}

.test-result li:last-child {
  border-bottom: 0;
}

.test-result a {
  color: var(--color-primary-light);
  font-weight: 500;
}

.test-result .snippet {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
  line-height: 1.5;
}

.test-error {
  margin-top: 16px;
}
</style>