<template>
  <div class="hot-topics-widget">
    <div v-for="topic in topics" :key="topic.id" class="hot-topic-card">
      <div class="hot-topic-card__header">
        <span class="hot-topic-card__keywords">{{ topic.keywords?.join(', ') }}</span>
        <span class="hot-topic-card__score">评分 {{ topic.score }}</span>
      </div>
      <div class="hot-topic-card__stats">
        <span class="hot-topic-card__stat">热度 {{ topic.currentVolume }}</span>
        <span class="hot-topic-card__stat" :class="{ 'trend-up': topic.growthRate > 0, 'trend-down': topic.growthRate < 0 }">
          {{ topic.growthRate > 0 ? '+' : '' }}{{ topic.growthRate?.toFixed(1) }}%
        </span>
        <span class="hot-topic-card__trend" :class="`trend--${topic.trend}`">
          {{ trendLabel(topic.trend) }}
        </span>
      </div>
    </div>
    <div v-if="topics.length === 0" class="hot-topics-empty">暂无热点话题</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: any }>();
const topics = computed(() => props.data?.data || []);

function trendLabel(t: string): string {
  return { rising: '上升', falling: '下降', stable: '稳定' }[t] || t;
}
</script>

<style scoped>
.hot-topics-widget {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.hot-topic-card {
  padding: 12px;
  background: rgba(94, 114, 228, 0.04);
  border: 1px solid rgba(140, 155, 240, 0.08);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.hot-topic-card:hover {
  border-color: rgba(140, 155, 240, 0.2);
}

.hot-topic-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.hot-topic-card__keywords {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.hot-topic-card__score {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(94, 114, 228, 0.12);
  color: var(--color-primary);
}

.hot-topic-card__stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.hot-topic-card__stat {
  color: var(--text-tertiary);
}

.trend-up { color: #34D399; }
.trend-down { color: #F87171; }

.hot-topic-card__trend {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
}

.trend--rising { color: #34D399; background: rgba(52,211,153,0.1); }
.trend--falling { color: #F87171; background: rgba(248,113,113,0.1); }
.trend--stable { color: #94A3B8; background: rgba(148,163,184,0.1); }

.hot-topics-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
