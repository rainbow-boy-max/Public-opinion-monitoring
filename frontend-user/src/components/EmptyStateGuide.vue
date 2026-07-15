<template>
  <div class="empty-state-guide">
    <GlassCard>
      <div class="empty-state-guide__content">
        <div class="empty-state-guide__icon">{{ icon }}</div>
        <h3 class="empty-state-guide__title">{{ title }}</h3>
        <p class="empty-state-guide__desc">{{ description }}</p>
        <div class="empty-state-guide__actions">
          <el-button v-if="primaryAction" type="primary" @click="$emit('primary')">
            {{ primaryAction }}
          </el-button>
          <el-button v-if="secondaryAction" @click="$emit('secondary')">
            {{ secondaryAction }}
          </el-button>
        </div>
      </div>
    </GlassCard>
  </div>
</template>

<script setup lang="ts">
import GlassCard from '@shared/components/GlassCard.vue';

interface Props {
  icon?: string;
  title: string;
  description: string;
  primaryAction?: string | null;
  secondaryAction?: string | null;
}

withDefaults(defineProps<Props>(), {
  icon: '📋',
  primaryAction: null,
  secondaryAction: null,
});

defineEmits<{
  primary: [];
  secondary: [];
}>();
</script>

<style scoped>
.empty-state-guide {
  padding: 60px 0;
}

.empty-state-guide__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
  gap: 12px;
}

.empty-state-guide__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 4px;
  filter: drop-shadow(0 0 12px rgba(94, 114, 228, 0.3));
}

.empty-state-guide__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-state-guide__desc {
  font-size: 14px;
  color: var(--text-tertiary);
  line-height: 1.6;
  margin: 0;
}

.empty-state-guide__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
</style>
