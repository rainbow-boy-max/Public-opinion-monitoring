<template>
  <div class="event-list">
    <div v-for="evt in events" :key="evt.id" class="event-item">
      <PlatformTag :platform="evt.platform" :label="platformLabel(evt.platform)" />
      <div class="event-item__title">{{ evt.title }}</div>
      <div class="event-item__meta">
        <SentimentBadge :type="evt.sentiment" />
        <span class="event-item__time">{{ formatTime(evt.matchedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PlatformTag from '@shared/components/PlatformTag.vue';
import SentimentBadge from '@shared/components/SentimentBadge.vue';

const props = defineProps<{ data: any }>();

const events = computed(() => props.data?.data || []);

function platformLabel(p: string): string {
  const m: Record<string, string> = { weixin: '微信', weixin_video: '视频号', douyin: '抖音', xiaohongshu: '小红书', kuaishou: '快手', weibo: '微博', baijiahao: '百家号' };
  return m[p] || p;
}

function formatTime(t: string): string {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.event-list {
  display: flex;
  flex-direction: column;
  max-height: 400px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background var(--transition-fast);
}

.event-item:last-child {
  border-bottom: none;
}

.event-item:hover {
  background: rgba(94, 114, 228, 0.04);
}

.event-item__title {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.event-item__time {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}
</style>
