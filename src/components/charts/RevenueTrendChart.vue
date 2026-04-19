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

const option = computed<DashboardChartOption>(() => {
  const currentHour = store.scenarioData.hourly[store.liveHourIndex].hour;

  return {
    grid: commonGrid,
    tooltip: tooltipTheme,
    xAxis: {
      type: 'category' as const,
      data: store.scenarioData.hourly.map((item) => item.hour),
      ...commonAxis,
    },
    yAxis: [
      {
        type: 'value' as const,
        name: '¥',
        ...commonAxis,
      },
      {
        type: 'value' as const,
        name: '电价',
        ...commonAxis,
      },
    ],
    series: [
      {
        type: 'bar',
        name: '调度收益',
        barWidth: 12,
        itemStyle: {
          color: '#15f5ba',
          borderRadius: [6, 6, 0, 0],
        },
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#ffd66b', width: 1.4, type: 'dashed' as const },
          label: { formatter: '当前回放', color: '#ffd66b' },
          data: [{ xAxis: currentHour }],
        },
        data: store.scenarioData.hourly.map((item) => item.savingCny),
      },
      {
        type: 'line' as const,
        name: '峰谷电价',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: '#ffd66b' },
        lineStyle: { color: '#ffd66b', width: 2 },
        data: store.scenarioData.hourly.map((item) => item.priceCny),
      },
    ],
  };
});
</script>
