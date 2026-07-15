<template>
  <div class="config-page">
    <GlassCard title="TTS 语音合成配置" icon="🔊" subtitle="MiniMax TTS 语音播报服务配置">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="160px">
        <el-form-item label="MiniMax API Key" prop="apiKey">
          <el-input v-model="form.apiKey" show-password placeholder="MiniMax TTS API Key" />
          <div class="form-tip">用于 PR 报告的语音播报功能，从 <code>https://platform.minimax.io</code> 获取</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        </el-form-item>
      </el-form>
    </GlassCard>

    <GlassCard title="语音试听" icon="🎧" subtitle="选择声音和语速，试听效果">
      <div class="test-area">
        <el-select v-model="testVoice" placeholder="选择声音" style="width: 200px">
          <el-option
            v-for="v in voices"
            :key="v.id"
            :label="v.name"
            :value="v.id"
          >
            <div class="voice-option">
              <div class="voice-option__name">{{ v.name }}</div>
              <div class="voice-option__desc">{{ v.description }}</div>
            </div>
          </el-option>
        </el-select>
        <el-slider
          v-model="testSpeed"
          :min="0.5"
          :max="2.0"
          :step="0.1"
          show-input
          input-size="small"
          style="width: 200px"
        >
          <template #prepend>语速</template>
        </el-slider>
      </div>
      <div class="test-area" style="margin-top: 12px">
        <el-input
          v-model="testText"
          type="textarea"
          :rows="4"
          placeholder="输入要试听的文本内容..."
        />
      </div>
      <div class="test-area" style="margin-top: 12px">
        <el-button type="primary" :loading="testing" @click="onTestTts">试听</el-button>
      </div>
      <div v-if="testError" class="test-error">{{ testError }}</div>
      <div v-if="testAudioUrl" class="test-player">
        <audio :src="testAudioUrl" controls autoplay style="width: 100%"></audio>
      </div>
    </GlassCard>

    <GlassCard title="可用声音列表" icon="🗣️" subtitle="MiniMax TTS 支持的语音角色">
      <el-table :data="voices" stripe>
        <el-table-column prop="id" label="ID" width="180" />
        <el-table-column prop="name" label="名称" width="140" />
        <el-table-column prop="description" label="描述" />
      </el-table>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'TtsConfigPage' });
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const formRef = ref<FormInstance>();
const saving = ref(false);
const testing = ref(false);

const form = reactive({
  apiKey: '',
});

const rules = {};

const voices = ref<Array<{ id: string; name: string; description: string }>>([]);
const testVoice = ref('female-chengshu');
const testSpeed = ref(1.0);
const testText = ref('这是一段测试语音，用于验证 MiniMax TTS 服务的配置是否正确。');
const testAudioUrl = ref('');
const testError = ref('');

async function loadVoices(): Promise<void> {
  try {
    voices.value = await http.get('/tts/voices');
  } catch (err) {
    console.error(err);
  }
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    await http.post('/admin/config/tts', { apiKey: form.apiKey });
    ElMessage.success('TTS 配置已保存');
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onTestTts(): Promise<void> {
  if (!testText.value.trim()) {
    ElMessage.warning('请输入试听文本');
    return;
  }
  testing.value = true;
  testError.value = '';
  testAudioUrl.value = '';
  try {
    const res = await http.post('/tts/synthesize', {
      text: testText.value,
      voiceId: testVoice.value,
      speed: testSpeed.value,
    });
    testAudioUrl.value = `data:audio/mp3;base64,${res.audioBase64}`;
  } catch (err: any) {
    testError.value = err?.message || '语音合成失败';
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  loadVoices();
});
</script>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.form-tip code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-primary-light);
}

.test-area {
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

.voice-option__desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.test-error {
  color: var(--color-danger);
  font-size: 13px;
  margin-top: 8px;
}

.test-player {
  margin-top: 12px;
  padding: 12px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}
</style>
