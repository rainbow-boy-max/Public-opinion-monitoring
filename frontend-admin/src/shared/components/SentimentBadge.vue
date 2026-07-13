/**
 * SentimentBadge - 情感倾向徽标
 */
<template>
  <span class="sentiment-badge" :class="`sentiment-badge--${type}`">
    <span class="sentiment-badge__icon">{{ icon }}</span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  type: 'positive' | 'negative' | 'neutral';
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
});

const ICON_MAP = { positive: '◉', negative: '◉', neutral: '◉' };
const LABEL_MAP = { positive: '正面', negative: '负面', neutral: '中性' };

const icon = computed(() => ICON_MAP[props.type]);
const label = computed(() => props.label || LABEL_MAP[props.type]);
</script>

<style scoped>
.sentiment-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.sentiment-badge__icon {
  font-size: 8px;
  line-height: 1;
}

.sentiment-badge--positive {
  color: #34D399;
  background: rgba(16, 185, 129, 0.15);
}

.sentiment-badge--negative {
  color: #F87171;
  background: rgba(239, 68, 68, 0.15);
}

.sentiment-badge--neutral {
  color: #94A3B8;
  background: rgba(148, 163, 184, 0.12);
}
</style>
