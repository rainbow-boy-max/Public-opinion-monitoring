<template>
  <div ref="chartEl" style="height: 280px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';

const props = defineProps<{ data: any }>();
const chartEl = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

const gaugeValue = computed(() => props.data?.value ?? 50);

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const v = gaugeValue.value;
  const color = v >= 70 ? '#34D399' : v >= 40 ? '#F59E0B' : '#F87171';
  chart.setOption({
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '80%',
      startAngle: 220,
      endAngle: -40,
      min: 0, max: 100,
      progress: { show: true, width: 12, itemStyle: { color } },
      axisLine: { lineStyle: { width: 12, color: [[1, 'rgba(140,155,240,0.12)']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        offsetCenter: [0, 20],
        fontSize: 28,
        fontWeight: 'bold',
        color: color,
        formatter: `{value}`,
      },
      data: [{ value: v }],
    }],
  });
}

watch(() => props.data, render, { deep: true });
onMounted(render);
onUnmounted(() => { chart?.dispose(); chart = null; });
</script>
