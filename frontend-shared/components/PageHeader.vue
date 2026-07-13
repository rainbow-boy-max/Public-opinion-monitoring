/**
 * PageHeader - 页面顶部标题区
 */
<template>
  <header class="page-header">
    <div class="page-header__main">
      <div class="page-header__title-group">
        <h1 class="page-header__title" :class="{ 'page-header__title--gradient': gradient }">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="breadcrumbs && breadcrumbs.length" class="page-header__breadcrumbs">
      <span v-for="(item, idx) in breadcrumbs" :key="idx" class="page-header__crumb">
        {{ item }}
        <span v-if="idx < breadcrumbs.length - 1" class="page-header__crumb-sep">/</span>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  subtitle?: string;
  gradient?: boolean;
  breadcrumbs?: string[];
}

withDefaults(defineProps<Props>(), {
  gradient: true,
});
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
  animation: fade-in 250ms ease-out both;
}

.page-header__main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header__title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-header__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.page-header__title--gradient {
  background: linear-gradient(135deg, #FFFFFF 0%, #7C8FE8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.page-header__subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

.page-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-header__breadcrumbs {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.page-header__crumb {
  display: inline-block;
}

.page-header__crumb-sep {
  margin: 0 6px;
  opacity: 0.5;
}
</style>
