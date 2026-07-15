<template>
  <el-dialog v-model="visible" title="导出数据" width="520" :close-on-click-modal="false">
    <el-form label-width="100px">
      <el-form-item label="导出格式">
        <el-radio-group v-model="form.format">
          <el-radio-button value="csv">CSV</el-radio-button>
          <el-radio-button value="json">JSON</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="showTaskSelect" label="选择任务">
        <el-select v-model="form.taskIds" multiple placeholder="选择要导出的任务" style="width: 100%">
          <el-option
            v-for="t in taskOptions"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="时间范围">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item v-if="showFilters" label="情感倾向">
        <el-select v-model="form.sentiment" placeholder="全部" clearable style="width: 100%">
          <el-option label="正面" value="positive" />
          <el-option label="负面" value="negative" />
          <el-option label="中性" value="neutral" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="showFilters" label="平台">
        <el-select v-model="form.platform" placeholder="全部" clearable style="width: 100%">
          <el-option v-for="p in platformOptions" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>

      <el-form-item label="文件命名">
        <el-input v-model="form.customFilename" placeholder="可选，留空自动生成" />
      </el-form-item>
    </el-form>

    <div v-if="progressVisible" class="export-progress">
      <el-progress :percentage="progressPercent" :stroke-width="8" />
      <span class="export-progress__text">{{ progressText }}</span>
    </div>

    <div v-if="downloadUrl" class="export-download">
      <el-alert title="导出完成" type="success" show-icon :closable="false" />
      <el-button type="primary" @click="onDownload" class="export-download__btn">下载文件</el-button>
    </div>

    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" :loading="loading" :disabled="!canExport" @click="onExport">
        {{ loading ? '生成中...' : '导出' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';

interface TaskOption {
  id: number;
  name: string;
}

interface ExportForm {
  format: 'csv' | 'json';
  taskIds: number[];
  dateRange: [string, string] | null;
  sentiment: string;
  platform: string;
  customFilename: string;
}

interface Props {
  showTaskSelect?: boolean;
  showFilters?: boolean;
  exportType: 'events' | 'tasks' | 'stats';
  taskOptions?: TaskOption[];
  platformOptions?: { value: string; label: string }[];
  defaultTaskId?: number;
}

const props = withDefaults(defineProps<Props>(), {
  showTaskSelect: false,
  showFilters: false,
  taskOptions: () => [],
  platformOptions: () => [
    { value: 'weixin', label: '微信公众号' },
    { value: 'weixin_video', label: '微信视频号' },
    { value: 'douyin', label: '抖音' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'kuaishou', label: '快手' },
    { value: 'weibo', label: '微博' },
    { value: 'baijiahao', label: '百家号' },
  ],
  defaultTaskId: 0,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const visible = ref(false);
const loading = ref(false);
const progressVisible = ref(false);
const progressPercent = ref(0);
const progressText = ref('');
const downloadUrl = ref('');
const downloadBlob = ref<Blob | null>(null);

const form = reactive<ExportForm>({
  format: 'csv',
  taskIds: props.defaultTaskId ? [props.defaultTaskId] : [],
  dateRange: null,
  sentiment: '',
  platform: '',
  customFilename: '',
});

const canExport = computed(() => {
  if (props.exportType === 'stats' || props.showTaskSelect) {
    return form.taskIds.length > 0;
  }
  return true;
});

function open(): void {
  visible.value = true;
  progressVisible.value = false;
  progressPercent.value = 0;
  progressText.value = '';
  downloadUrl.value = '';
  downloadBlob.value = null;
  if (props.defaultTaskId && form.taskIds.length === 0) {
    form.taskIds = [props.defaultTaskId];
  }
}

function close(): void {
  visible.value = false;
  emit('close');
}

function onCancel(): void {
  close();
}

function simulateProgress(): void {
  progressVisible.value = true;
  progressPercent.value = 0;
  progressText.value = '正在准备数据...';
  const interval = setInterval(() => {
    if (progressPercent.value < 90) {
      progressPercent.value += Math.random() * 15;
      if (progressPercent.value > 90) progressPercent.value = 90;
      if (progressPercent.value > 30 && progressPercent.value < 50) {
        progressText.value = '正在生成文件...';
      } else if (progressPercent.value >= 50) {
        progressText.value = '即将完成...';
      }
    } else {
      clearInterval(interval);
    }
  }, 300);
  return interval;
}

async function onExport(): Promise<void> {
  loading.value = true;
  const progressInterval = simulateProgress();

  try {
    const body: any = { format: form.format };

    if (props.exportType === 'events') {
      body.taskId = form.taskIds[0] || props.defaultTaskId;
      if (form.dateRange) {
        body.startDate = form.dateRange[0];
        body.endDate = form.dateRange[1];
      }
      if (form.sentiment) body.sentiment = form.sentiment;
      if (form.platform) body.platform = form.platform;
    } else if (props.exportType === 'tasks') {
    } else if (props.exportType === 'stats') {
      body.taskIds = form.taskIds;
      body.timeRange = '7d';
    }

    const endpoint = `/export/${props.exportType}`;
    const blob = await http.post(endpoint, body, { responseType: 'blob' }) as Blob;

    clearInterval(progressInterval);
    progressPercent.value = 100;
    progressText.value = '完成';

    const ext = form.format === 'csv' ? 'csv' : 'json';
    const filename = form.customFilename
      ? `${form.customFilename}.${ext}`
      : `${props.exportType}_${new Date().toISOString().slice(0, 10)}.${ext}`;

    downloadBlob.value = blob;
    downloadUrl.value = URL.createObjectURL(blob);

    ElMessage.success('导出完成');
    loading.value = false;

    triggerDownload(filename, blob);
    close();
  } catch (err: any) {
    clearInterval(progressInterval);
    progressVisible.value = false;
    ElMessage.error(err?.message || '导出失败');
    loading.value = false;
  }
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function onDownload(): void {
  if (!downloadBlob.value) return;
  const ext = form.format === 'csv' ? 'csv' : 'json';
  const filename = form.customFilename
    ? `${form.customFilename}.${ext}`
    : `${props.exportType}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  triggerDownload(filename, downloadBlob.value);
}

defineExpose({ open, close });
</script>

<style scoped>
.export-progress {
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.export-progress__text {
  font-size: 13px;
  color: var(--text-tertiary);
}

.export-download {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.export-download__btn {
  min-width: 160px;
}
</style>
