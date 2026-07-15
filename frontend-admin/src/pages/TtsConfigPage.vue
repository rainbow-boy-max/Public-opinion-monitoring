<template>
  <div class="config-page">
    <GlassCard title="TTS 语音合成配置" icon="🔊" subtitle="选择语音合成供应商并配置参数">
      <el-form ref="formRef" :model="form" label-width="160px">

        <el-form-item label="语音供应商" prop="provider">
          <el-radio-group v-model="form.provider" @change="onProviderChange">
            <el-radio-button v-for="p in providers" :key="p.name" :value="p.name">
              {{ p.displayName }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.provider === 'minimax'">
          <el-form-item label="MiniMax API Key" prop="apiKey" :rules="form.provider === 'minimax' ? [{ required: true, message: '请输入 API Key' }] : []">
            <el-input v-model="form.apiKey" show-password placeholder="MiniMax TTS API Key" />
            <div class="form-tip">从 <code>https://platform.minimax.chat</code> 获取，使用国内版 API</div>
          </el-form-item>
          <el-form-item label="Group ID" prop="groupId">
            <el-input v-model="form.groupId" placeholder="MiniMax Group ID（选填）" />
            <div class="form-tip">MiniMax 国内版需要 GroupId，可在控制台基本信息页找到</div>
          </el-form-item>
        </template>

        <template v-if="form.provider === 'xiaomi'">
          <el-form-item label="小米 API Key" prop="apiKey" :rules="form.provider === 'xiaomi' ? [{ required: true, message: '请输入 API Key' }] : []">
            <el-input v-model="form.apiKey" show-password placeholder="小米 MiMo API Key" />
            <div class="form-tip">从 <code>https://platform.xiaomimimo.com</code> 获取</div>
          </el-form-item>
        </template>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="语音试听" icon="🎧" subtitle="选择供应商、声音和语速，试听效果">
      <div class="test-controls">
        <el-select v-model="testProvider" placeholder="选择供应商" style="width: 160px" @change="onTestProviderChange">
          <el-option v-for="p in providers" :key="p.name" :label="p.displayName" :value="p.name" />
        </el-select>
        <el-select v-model="testVoice" placeholder="选择声音" style="width: 200px">
          <el-option v-for="v in filteredVoices" :key="v.id" :label="v.name" :value="v.id">
            <div class="voice-option">
              <div class="voice-option__name">{{ v.name }}</div>
              <div class="voice-option__desc">{{ v.description }}</div>
            </div>
          </el-option>
        </el-select>
        <el-slider v-model="testSpeed" :min="0.5" :max="2.0" :step="0.1" show-input input-size="small" style="width: 180px">
          <template #prepend>语速</template>
        </el-slider>
      </div>
      <div class="test-area">
        <el-input v-model="testText" type="textarea" :rows="3" placeholder="输入要试听的文本内容..." />
      </div>
      <div class="test-area">
        <el-button type="primary" :loading="testing" @click="onTestTts">试听</el-button>
      </div>
      <div v-if="testError" class="test-error">{{ testError }}</div>
      <div v-if="testAudioUrl" class="test-player">
        <audio :src="testAudioUrl" controls autoplay style="width: 100%"></audio>
      </div>
    </GlassCard>

    <GlassCard :title="`可用声音列表 - ${currentProviderName}`" icon="🗣️" subtitle="当前供应商支持的语音角色">
      <el-table :data="filteredVoices" stripe>
        <el-table-column prop="name" label="名称" width="100" />
        <el-table-column prop="id" label="ID" width="180" />
        <el-table-column prop="gender" label="性别" width="60">
          <template #default="{ row }">
            <el-tag :type="row.gender === 'female' ? 'danger' : 'primary'" size="small">
              {{ row.gender === 'female' ? '女声' : row.gender === 'male' ? '男声' : '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="language" label="语言" width="100" />
        <el-table-column prop="description" label="描述" />
      </el-table>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'TtsConfigPage' });
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const formRef = ref<FormInstance>();
const saving = ref(false);
const testing = ref(false);

interface Provider {
  name: string;
  displayName: string;
  active: boolean;
}

interface Voice {
  id: string;
  name: string;
  gender?: string;
  language?: string;
  description?: string;
  provider: string;
}

const providers = ref<Provider[]>([]);
const voices = ref<Voice[]>([]);

const form = reactive({
  provider: 'minimax',
  apiKey: '',
  groupId: '',
});

const testProvider = ref('minimax');
const testVoice = ref('');
const testSpeed = ref(1.0);
const testText = ref('这是一段测试语音，用于验证 TTS 服务的配置是否正确。');
const testAudioUrl = ref('');
const testError = ref('');

const filteredVoices = computed(() => {
  return voices.value.filter(v => v.provider === testProvider.value);
});

const currentProviderName = computed(() => {
  const p = providers.value.find(p => p.name === form.provider);
  return p?.displayName || form.provider;
});

async function loadData(): Promise<void> {
  try {
    providers.value = await http.get('/tts/providers');
    const active = providers.value.find(p => p.active);
    if (active) {
      form.provider = active.name;
      testProvider.value = active.name;
    }
    const allVoices: Voice[] = await http.get('/tts/voices');
    voices.value = allVoices;
    const defaultVoice = allVoices.find(v => v.provider === testProvider.value);
    if (defaultVoice) testVoice.value = defaultVoice.id;
  } catch (err) {
    console.error(err);
  }
}

function onProviderChange(): void {
  testProvider.value = form.provider;
  const first = filteredVoices.value[0];
  if (first) testVoice.value = first.id;
}

function onTestProviderChange(): void {
  const first = filteredVoices.value[0];
  if (first) testVoice.value = first.id;
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    const payload: Record<string, string> = { provider: form.provider, apiKey: form.apiKey };
    if (form.provider === 'minimax' && form.groupId) payload.groupId = form.groupId;
    await http.post('/admin/config/tts', payload);
    ElMessage.success(`TTS ${form.provider} 配置已保存`);
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTestTts(): Promise<void> {
  if (!testText.value.trim()) { ElMessage.warning('请输入试听文本'); return; }
  testing.value = true;
  testError.value = '';
  testAudioUrl.value = '';
  try {
    const res = await http.post('/tts/synthesize', {
      text: testText.value,
      voiceId: testVoice.value,
      speed: testSpeed.value,
      provider: testProvider.value,
    });
    testAudioUrl.value = `data:audio/mp3;base64,${res.audioBase64}`;
  } catch (err: any) {
    testError.value = err?.message || '语音合成失败';
  } finally {
    testing.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.config-page { display: flex; flex-direction: column; gap: 20px; }
.form-tip { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
.form-tip code { font-family: 'JetBrains Mono', monospace; color: var(--color-primary-light); }
.test-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.test-area { margin-top: 12px; }
.voice-option { display: flex; flex-direction: column; gap: 2px; }
.voice-option__name { font-size: 14px; font-weight: 500; }
.voice-option__desc { font-size: 12px; color: var(--text-tertiary); }
.test-error { color: var(--color-danger); font-size: 13px; margin-top: 8px; }
.test-player { margin-top: 12px; padding: 12px; background: var(--glass-bg); border-radius: var(--radius-md); border: 1px solid var(--glass-border); }
</style>
