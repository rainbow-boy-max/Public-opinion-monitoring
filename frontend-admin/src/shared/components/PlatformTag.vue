/**
 * PlatformTag - 平台彩色标签
 */
<template>
  <span class="platform-tag" :class="`platform-tag--${platform}`">
    <span class="platform-tag__dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  platform: string;
  label: string;
}

defineProps<Props>();

const COLORS: Record<string, string> = {
  weixin: '#10B981',
  weixin_video: '#34D399',
  douyin: '#EF4444',
  xiaohongshu: '#EC4899',
  kuaishou: '#F59E0B',
  weibo: '#FF5C5C',
  baijiahao: '#3B82F6',
  webhook_ingest: '#8B5CF6',
  test: '#6B7280',
};

const _internal = COLORS; // keep referenced
</script>

<style scoped>
.platform-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(94, 114, 228, 0.15);
  color: var(--text-primary);
  border: 1px solid rgba(140, 155, 240, 0.1);
}

.platform-tag__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.platform-tag--weixin { color: #10B981; background: rgba(16, 185, 129, 0.12); }
.platform-tag--weixin_video { color: #34D399; background: rgba(52, 211, 153, 0.12); }
.platform-tag--douyin { color: #EF4444; background: rgba(239, 68, 68, 0.12); }
.platform-tag--xiaohongshu { color: #EC4899; background: rgba(236, 72, 153, 0.12); }
.platform-tag--kuaishou { color: #F59E0B; background: rgba(245, 158, 11, 0.12); }
.platform-tag--weibo { color: #FF5C5C; background: rgba(255, 92, 92, 0.12); }
.platform-tag--baijiahao { color: #3B82F6; background: rgba(59, 130, 246, 0.12); }
.platform-tag--webhook_ingest { color: #8B5CF6; background: rgba(139, 92, 246, 0.12); }
.platform-tag--test { color: #6B7280; background: rgba(107, 114, 128, 0.12); }
</style>
