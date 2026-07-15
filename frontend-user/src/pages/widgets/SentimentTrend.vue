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
    grid: { left: 40, right: 16, top: 32, bottom: 24 },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,25,56,0.95)', borderColor: 'rgba(94,114,228,0.3)', textStyle: { color: '#E8EBFF' } },
    legend: { textStyle: { color: '#9DA8E5' }, top: 0 },
    xAxis: { type: 'category', data: props.data.categories, axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(140,155,240,0.2)' } }, splitLine: { lineStyle: { color: 'rgba(140,155,240,0.08)' } } },
    series: [
      { type: 'line', name: '正面', smooth: true, data: props.data.series[0]?.data || [], lineStyle: { color: '#34D399', width: 2 }, itemStyle: { color: '#34D399' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(52,211,153,0.3)' }, { offset: 1, color: 'rgba(52,211,153,0)' }]) }, symbol: 'circle', symbolSize: 4 },
      { type: 'line', name: '负面', smooth: true, data: props.data.series[1]?.data || [], lineStyle: { color: '#F87171', width: 2 }, itemStyle: { color: '#F87171' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(248,113,113,0.3)' }, { offset: 1, color: 'rgba(248,113,113,0)' }]) }, symbol: 'circle', symbolSize: 4 },
      { type: 'line', name: '中性', smooth: true, data: props.data.series[2]?.data || [], lineStyle: { color: '#94A3B8', width: 2 }, itemStyle: { color: '#94A3B8' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(148,163,184,0.3)' }, { offset: 1, color: 'rgba(148,163,184,0)' }]) }, symbol: 'circle', symbolSize: 4 },
    ],
  });
}

watch(() => props.data, render, { deep: true });
onMounted(render);
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
