<template>
  <GlassCard :title="`任务 #${taskId} 舆情事件`" icon="🔍" subtitle="按时间倒序展示">
    <template #extra>
      <el-button @click="showExportDialog = true">导出</el-button>
      <el-button @click="$router.push('/tasks')">返回列表</el-button>
    </template>

    <div class="toolbar">
      <el-select v-model="platformFilter" placeholder="平台筛选" clearable style="width: 160px">
        <el-option v-for="p in platformOptions" :key="p" :label="p" :value="p" />
      </el-select>
      <el-input v-model="search" placeholder="搜索标题或内容" clearable style="width: 240px">
        <template #prefix>🔍</template>
      </el-input>
    </div>

    <div v-loading="loading" class="events-stream">
      <div v-if="!loading && filteredEvents.length === 0" class="empty">
        暂无舆情事件，去尝试创建监控任务吧
      </div>
      <article
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-card fade-in"
      >
        <div class="event-card__head">
          <PlatformTag
            :platform="event.platform"
            :label="event.platform"
          />
          <SentimentBadge :type="event.sentiment" />
          <span class="event-card__time">{{ formatDate(event.matchedAt || event.createdAt) }}</span>
        </div>
        <h3 class="event-card__title">
          <a :href="event.url" target="_blank" rel="noopener noreferrer">{{ event.title }}</a>
        </h3>
        <p class="event-card__summary">{{ event.summary }}</p>
        <div class="event-card__meta">
          <span><strong>{{ event.author }}</strong></span>
          <span class="meta-sep">·</span>
          <span>阅读 {{ event.readCount }}</span>
          <span class="meta-sep">·</span>
          <span>点赞 {{ event.likeCount }}</span>
          <span class="meta-sep">·</span>
          <span>评论 {{ event.commentCount }}</span>
          <span v-if="event.matchedKeywords?.length" class="meta-sep">·</span>
          <span v-if="event.matchedKeywords?.length" class="kw-list">
            关键词:
            <span v-for="k in event.matchedKeywords" :key="k" class="kw-tag">{{ k }}</span>
          </span>
        </div>
      </article>
    </div>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 24px; justify-content: flex-end"
      @current-change="load"
      @size-change="load"
    />
  </GlassCard>

  <el-dialog v-model="showExportDialog" title="导出舆情数据" width="480">
    <el-form label-width="100px">
      <el-form-item label="导出格式">
        <el-radio-group v-model="exportFormat">
          <el-radio-button value="csv">CSV</el-radio-button>
          <el-radio-button value="json">JSON</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="exportDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="情感倾向">
        <el-select v-model="exportSentiment" placeholder="全部" clearable style="width: 100%">
          <el-option label="正面" value="positive" />
          <el-option label="负面" value="negative" />
          <el-option label="中性" value="neutral" />
        </el-select>
      </el-form-item>
      <el-form-item label="平台">
        <el-select v-model="exportPlatform" placeholder="全部" clearable style="width: 100%">
          <el-option v-for="p in platformOptions" :key="p" :label="p" :value="p" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showExportDialog = false">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="doExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '@/utils/http';
import GlassCard from '@shared/components/GlassCard.vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

const route = useRoute();
const taskId = ref(Number(route.params.id));
const events = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const platformFilter = ref('');
const search = ref('');

const platformOptions = computed(() => {
  const set = new Set(events.value.map((e) => e.platform));
  return Array.from(set);
});

const filteredEvents = computed(() => {
  let items = events.value;
  if (platformFilter.value) {
    items = items.filter((e) => e.platform === platformFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    items = items.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.summary?.toLowerCase().includes(q) ||
        e.content?.toLowerCase().includes(q),
    );
  }
  return items;
});

function formatDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await http.get(`/monitor-tasks/${taskId.value}/events`, {
      params: { page: page.value, pageSize: pageSize.value },
    });
    events.value = res.items;
    total.value = res.total;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, () => {
  taskId.value = Number(route.params.id);
  load();
});

onMounted(load);

const showExportDialog = ref(false);
const exportFormat = ref<'csv' | 'json'>('csv');
const exportDateRange = ref<[string, string] | null>(null);
const exportSentiment = ref('');
const exportPlatform = ref('');
const exporting = ref(false);

async function doExport(): Promise<void> {
  exporting.value = true;
  try {
    const blob = await http.post(
      '/export/events',
      {
        taskId: taskId.value,
        format: exportFormat.value,
        startDate: exportDateRange.value?.[0],
        endDate: exportDateRange.value?.[1],
        sentiment: exportSentiment.value || undefined,
        platform: exportPlatform.value || undefined,
      },
      { responseType: 'blob' },
    ) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${taskId.value}_${new Date().toISOString().slice(0, 10)}.${exportFormat.value}`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
    showExportDialog.value = false;
  } catch (err: any) {
    ElMessage.error(err?.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.events-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  padding: 16px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.event-card:hover {
  border-color: var(--border-strong);
  transform: translateX(4px);
}

.event-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.event-card__time {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'JetBrains Mono', monospace;
}

.event-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.5;
}

.event-card__title a {
  color: var(--text-primary);
  text-decoration: none;
  background-image: linear-gradient(90deg, var(--color-primary-light), var(--color-accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.event-card__title a:hover {
  text-decoration: underline;
}

.event-card__summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.event-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-sep {
  opacity: 0.5;
}

.kw-list {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kw-tag {
  background: rgba(94, 114, 228, 0.18);
  color: #A78BFA;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>
