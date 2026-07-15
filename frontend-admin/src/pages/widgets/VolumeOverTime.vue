<template>
  <div ref="chartEl" style="height: 280px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{ data: any }>();
const chartEl = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

function render() {
  if (!chartEl.value || !props.data) return;
  if (!chart) chart = echarts.init(chartEl.value);
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#9DA8E5' },
    grid: { left: 40, right: 16, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    xAxis: { type: 'category', data: props.data.categories, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [{
      type: 'line', smooth: true, data: props.data.data, symbol: 'none',
      lineStyle: { color: '#5E72E4', width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(94,114,228,0.4)' }, { offset: 1, color: 'rgba(94,114,228,0)' }]) },
    }],
  });
}

watch(() => props.data, render, { deep: true });
onMounted(render);
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
