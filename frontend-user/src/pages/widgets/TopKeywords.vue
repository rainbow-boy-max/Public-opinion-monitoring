<template>
  <div class="tag-cloud">
    <span
      v-for="(kw, i) in sortedKeywords"
      :key="i"
      class="tag-cloud__item"
      :style="{ fontSize: getFontSize(kw.count), color: getColor(kw.count) }"
    >
      {{ kw.text }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: any }>();

const sortedKeywords = computed(() => {
  if (!props.data?.data) return [];
  return [...props.data.data].sort((a: any, b: any) => b.count - a.count).slice(0, 30);
});

const maxCount = computed(() => {
  if (sortedKeywords.value.length === 0) return 1;
  return Math.max(...sortedKeywords.value.map((k: any) => k.count));
});

function getFontSize(count: number): string {
  const ratio = count / maxCount.value;
  return `${12 + ratio * 18}px`;
}

function getColor(count: number): string {
  const ratio = count / maxCount.value;
  const colors = ['#94A3B8', '#5E72E4', '#7C3AED', '#EC4899', '#F59E0B', '#EF4444'];
  const idx = Math.min(Math.floor(ratio * colors.length), colors.length - 1);
  return colors[idx];
}
</script>

<style scoped>
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 16px;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.tag-cloud__item {
  cursor: default;
  transition: transform 0.2s;
  font-weight: 500;
  padding: 4px 0;
}

.tag-cloud__item:hover {
  transform: scale(1.15);
}
</style>
