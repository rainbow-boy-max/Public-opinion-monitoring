/**
 * StatCard - 数据指标卡
 * 用于仪表盘的关键指标展示，支持图标、趋势、点击
 */
<template>
  <div class="stat-card" :class="{ 'stat-card--glow': glow }" @click="$emit('click')">
    <div class="stat-card__icon" :style="{ background: iconBg }">
      <span>{{ icon }}</span>
    </div>
    <div class="stat-card__content">
      <div class="stat-card__label">{{ label }}</div>
      <div class="stat-card__value">
        <span class="stat-card__number" :class="valueClass">{{ value }}</span>
        <span v-if="unit" class="stat-card__unit">{{ unit }}</span>
      </div>
      <div v-if="trend !== undefined" class="stat-card__trend" :class="trendClass">
        <span>{{ trendIcon }} {{ trendText }}</span>
        <span v-if="trendLabel" class="stat-card__trend-label">{{ trendLabel }}</span>
      </div>
    </div>
    <div v-if="glow" class="stat-card__glow-bg" :style="{ background: glow }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  iconBg?: string;
  trend?: number;
  trendLabel?: string;
  glow?: string;
  valueClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  icon: '📊',
  iconBg: 'var(--gradient-primary)',
  valueClass: '',
});

defineEmits<{ click: [] }>();

const trendIcon = computed(() => {
  if (props.trend === undefined) return '';
  return props.trend >= 0 ? '↑' : '↓';
});

const trendText = computed(() => {
  if (props.trend === undefined) return '';
  const sign = props.trend >= 0 ? '+' : '';
  return `${sign}${props.trend}%`;
});

const trendClass = computed(() => {
  if (props.trend === undefined) return '';
  return props.trend >= 0 ? 'trend-up' : 'trend-down';
});
</script>

<style scoped>
.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  transition: all var(--transition-normal);
  cursor: pointer;
  overflow: hidden;
  animation: fade-in 250ms ease-out both;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.5), 0 0 24px rgba(94, 114, 228, 0.15);
}

.stat-card__icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 1;
}

.stat-card__content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.stat-card__label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.stat-card__value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}

.stat-card__number {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #FFFFFF 0%, #C7CFF6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.stat-card__unit {
  font-size: 13px;
  color: var(--text-tertiary);
}

.stat-card__trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.trend-up {
  color: var(--color-success);
}

.trend-down {
  color: var(--color-danger);
}

.stat-card__trend-label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.stat-card--glow {
  position: relative;
}

.stat-card__glow-bg {
  position: absolute;
  top: 0;
  right: 0;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}
</style>
