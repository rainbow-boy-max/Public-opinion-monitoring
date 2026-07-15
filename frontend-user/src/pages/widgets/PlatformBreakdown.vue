<template>
  <div ref="chartEl" style="height: 280px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{ data: any }>();
const chartEl = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

const colorMap: Record<string, string> = {
  '微信': '#10B981', '抖音': '#EF4444', '微博': '#FF5C5C',
  '小红书': '#EC4899', '快手': '#F59E0B', '百家号': '#3B82F6',
  'weixin': '#10B981', 'douyin': '#EF4444', 'weibo': '#FF5C5C',
  'xiaohongshu': '#EC4899', 'kuaishou': '#F59E0B', 'baijiahao': '#3B82F6',
  'weixin_video': '#34D399',
};

function render() {
  if (!chartEl.value || !props.data) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const items = (props.data.data || []).map((d: any) => ({ ...d, itemStyle: { color: colorMap[d.name] || '#6B7280' } }));
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    tooltip: { trigger: 'item', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' }, formatter: '{b}: {c} ({d}%)' },
    legend: { textStyle: { color: '#9DA8E5' }, bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: items,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
    }],
  });
}

watch(() => props.data, render, { deep: true });
onMounted(render);
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
