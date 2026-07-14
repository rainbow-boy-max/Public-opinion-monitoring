import * as echarts from 'echarts/core';
import { LineChart, PieChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsOption };

export function createChart(el: HTMLElement, option: EChartsOption): echarts.ECharts {
  const instance = echarts.getInstanceByDom(el) ?? echarts.init(el);
  instance.setOption(option, true);
  return instance;
}

export function disposeChart(chart: echarts.ECharts | null | undefined): void {
  if (!chart) return;
  try {
    chart.dispose();
  } catch {
    /* ignore */
  }
}
