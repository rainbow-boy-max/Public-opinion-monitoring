<template>
  <GlassCard :title="`任务 #${taskId} 舆情事件`" icon="🔍" subtitle="按时间倒序展示">
    <template #extra>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
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
