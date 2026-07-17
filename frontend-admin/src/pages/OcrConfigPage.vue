<template>
  <div class="config-page">
    <GlassCard title="视觉模型状态" icon="👁️" subtitle="已启用且支持视觉能力的 LLM 模型">
      <div v-if="loading" v-loading="true" style="min-height: 100px" />
      <div v-else>
        <div v-if="visionModels.length === 0" class="empty-state">
          暂无可用视觉模型，请在 LLM 模型管理中配置并启用支持视觉的模型（如 GPT-4o、Qwen-VL 等）
        </div>
        <el-table v-else :data="visionModels" stripe>
          <el-table-column prop="provider" label="供应商" width="120" />
          <el-table-column prop="model" label="模型" width="200" />
          <el-table-column prop="displayName" label="显示名称" />
        </el-table>
      </div>
    </GlassCard>

    <GlassCard title="图片文字识别" icon="🖼️" subtitle="输入图片 URL，使用视觉模型提取文字">
      <div class="test-row">
        <el-input v-model="imageUrl" placeholder="输入图片 URL" style="flex: 1">
          <template #prefix>🔗</template>
        </el-input>
        <el-button type="primary" :loading="imageLoading" @click="onRecognizeImage">识别</el-button>
      </div>
      <div v-if="imageResult" class="result-box">
        <div class="result-label">识别结果：</div>
        <pre class="result-text">{{ imageResult }}</pre>
      </div>
    </GlassCard>

    <GlassCard title="视频内容识别" icon="🎬" subtitle="输入视频 URL，提取视频中的文字信息">
      <div class="test-row">
        <el-input v-model="videoUrl" placeholder="输入视频 URL" style="flex: 1">
          <template #prefix>🔗</template>
        </el-input>
        <el-input-number v-model="frameInterval" :min="1" :max="60" placeholder="帧间隔" style="width: 120px" />
        <el-button type="primary" :loading="videoLoading" @click="onRecognizeVideo">识别</el-button>
      </div>
      <div v-if="videoResult" class="result-box">
        <div class="result-label">识别结果：</div>
        <pre class="result-text">{{ videoResult.text }}</pre>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';

const loading = ref(false);
const visionModels = ref<any[]>([]);
const imageUrl = ref('');
const imageLoading = ref(false);
const imageResult = ref('');
const videoUrl = ref('');
const frameInterval = ref(5);
const videoLoading = ref(false);
const videoResult = ref<{ text: string; frames: any[] } | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await http.get('/ocr/config');
    visionModels.value = res.visionModels || [];
  } catch { /* ignore */ } finally { loading.value = false; }
});

async function onRecognizeImage(): Promise<void> {
  if (!imageUrl.value) { ElMessage.warning('请输入图片 URL'); return; }
  imageLoading.value = true;
  imageResult.value = '';
  try {
    const res = await http.post('/ocr/image', { url: imageUrl.value });
    imageResult.value = res.text;
  } catch (err: any) { ElMessage.error(err?.message || '识别失败'); } finally { imageLoading.value = false; }
}

async function onRecognizeVideo(): Promise<void> {
  if (!videoUrl.value) { ElMessage.warning('请输入视频 URL'); return; }
  videoLoading.value = true;
  videoResult.value = null;
  try {
    const res = await http.post('/ocr/video', { url: videoUrl.value, frameInterval: frameInterval.value });
    videoResult.value = res;
  } catch (err: any) { ElMessage.error(err?.message || '识别失败'); } finally { videoLoading.value = false; }
}
</script>

<style scoped>
.test-row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.result-box { margin-top: 16px; padding: 16px; background: var(--glass-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
.result-label { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary); }
.result-text { white-space: pre-wrap; word-break: break-all; font-size: 13px; line-height: 1.6; color: var(--text-primary); margin: 0; font-family: inherit; }
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-tertiary); font-size: 14px; }
</style>
