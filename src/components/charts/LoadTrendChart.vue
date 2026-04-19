<template>
  <BaseChart :option="option" />
</template>

<script setup lang="ts">
import type { DashboardChartOption } from './chartTheme';
import { computed } from 'vue';
import BaseChart from './BaseChart.vue';
import { commonAxis, commonGrid, lineSeries, tooltipTheme } from './chartTheme';
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
    yAxis: {
      type: 'value' as const,
      name: 'kW',
      ...commonAxis,
    },
    series: [
      {
        ...lineSeries(
          '空调负荷',
          '#46b3ff',
          store.scenarioData.hourly.map((item) => item.loadKw),
        ),
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#ffd66b', width: 1.4, type: 'dashed' as const },
          label: { formatter: '当前回放', color: '#ffd66b' },
          data: [{ xAxis: currentHour }],
        },
      },
    ],
  };
});
</script>
