/**
 * GlassCard - 通用玻璃拟态卡片
 * 半透明背景 + 模糊 + 渐变边光
 */
<template>
  <div class="glass-card" :class="{ 'glass-card--hoverable': hoverable, 'glass-card--padded': padded }">
    <div v-if="$slots.header || title" class="glass-card__header">
      <div class="glass-card__title">
        <span v-if="icon" class="glass-card__icon" :style="{ color: iconColor }">{{ icon }}</span>
        <span class="glass-card__title-text">{{ title }}</span>
        <span v-if="subtitle" class="glass-card__subtitle">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.extra" class="glass-card__extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="glass-card__body" :class="{ 'glass-card__body--bare': bare }">
      <slot />
    </div>
    <span v-if="glow" class="glass-card__glow" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  hoverable?: boolean;
  padded?: boolean;
  bare?: boolean;
  glow?: boolean;
}

withDefaults(defineProps<Props>(), {
  iconColor: 'var(--color-primary-light)',
  hoverable: false,
  padded: true,
  bare: false,
  glow: false,
});
</script>

<style scoped>
.glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  transition: all var(--transition-normal);
  animation: fade-in 250ms ease-out both;
}

.glass-card--hoverable {
  cursor: pointer;
}

.glass-card--hoverable:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: 0 12px 40px rgba(0, 5, 30, 0.55), 0 0 24px rgba(94, 114, 228, 0.2);
}

.glass-card__glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(94, 114, 228, 0.15) 0%, transparent 60%);
  pointer-events: none;
  opacity: 0.5;
  animation: pulse-glow 4s ease-in-out infinite;
}

.glass-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
  z-index: 1;
}

.glass-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.glass-card__icon {
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 6px currentColor);
}

.glass-card__title-text {
  letter-spacing: 0.3px;
}

.glass-card__subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 8px;
}

.glass-card__extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.glass-card__body {
  padding: 22px;
  position: relative;
  z-index: 1;
}

.glass-card__body--bare {
  padding: 0;
}

.glass-card:not(.glass-card--padded) .glass-card__body {
  padding: 0;
}
</style>
