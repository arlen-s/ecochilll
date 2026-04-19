<template>
  <BaseChart :option="option" />
</template>

<script setup lang="ts">
import type { DashboardChartOption } from './chartTheme';
import { computed } from 'vue';
import BaseChart from './BaseChart.vue';
import { commonAxis, commonGrid, tooltipTheme } from './chartTheme';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();

const option = computed<DashboardChartOption>(() => ({
  grid: commonGrid,
  tooltip: tooltipTheme,
  legend: {
    top: 0,
    right: 10,
    textStyle: { color: 'rgba(219,239,255,0.64)' },
  },
  xAxis: {
    type: 'category' as const,
    data: store.scenarioData.weekly.map((item) => item.date),
    ...commonAxis,
  },
  yAxis: [
    {
      type: 'value' as const,
      name: 'kg',
      ...commonAxis,
    },
    {
      type: 'value' as const,
      name: '%',
      ...commonAxis,
    },
  ],
  series: [
    {
      name: '碳减排',
      type: 'bar' as const,
      barWidth: 14,
      itemStyle: {
        color: '#15f5ba',
        borderRadius: [6, 6, 0, 0],
      },
      data: store.scenarioData.weekly.map((item) => item.carbonReductionKg),
    },
    {
      name: '节能率',
      type: 'line' as const,
      smooth: true,
      yAxisIndex: 1,
      symbolSize: 6,
      itemStyle: { color: '#46b3ff' },
      lineStyle: { color: '#46b3ff', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(70,179,255,0.35)' },
            { offset: 1, color: 'rgba(70,179,255,0)' },
          ],
        },
      },
      data: store.scenarioData.weekly.map((item) => item.savingRatePct),
    },
  ],
}));
</script>
