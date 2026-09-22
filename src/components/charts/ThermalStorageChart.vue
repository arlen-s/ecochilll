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
  const isCooling = store.operationMode === 'cooling';
  const currentHour = store.scenarioData.hourly[store.liveHourIndex].hour;
  const chargeSeries = lineSeries(
    isCooling ? '充冷功率' : '充热功率',
    '#46b3ff',
    store.scenarioData.hourly.map((item) => item.storageChargeKwTh),
  );
  const dischargeSeries = lineSeries(
    isCooling ? '放冷功率' : '放热功率',
    '#15f5ba',
    store.scenarioData.hourly.map((item) => item.storageDischargeKwTh),
  );
  const levelSeries = lineSeries(
    isCooling ? '蓄冷水位' : '蓄热水位',
    '#ffd66b',
    store.scenarioData.hourly.map((item) => item.storageLevelPct),
  );

  return {
    grid: commonGrid,
    tooltip: tooltipTheme,
    legend: {
      top: 0,
      right: 10,
      textStyle: { color: 'rgba(219,239,255,0.64)' },
    },
    xAxis: {
      type: 'category' as const,
      data: store.scenarioData.hourly.map((item) => item.hour),
      ...commonAxis,
    },
    yAxis: [
      {
        type: 'value' as const,
        name: 'kWth',
        ...commonAxis,
      },
      {
        type: 'value' as const,
        name: '%',
        min: 0,
        max: 100,
        ...commonAxis,
      },
    ],
    series: [
      {
        ...chargeSeries,
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#ffd66b', width: 1.4, type: 'dashed' as const },
          label: { formatter: '当前回放', color: '#ffd66b' },
          data: [{ xAxis: currentHour }],
        },
      },
      dischargeSeries,
      {
        ...levelSeries,
        yAxisIndex: 1,
        areaStyle: undefined,
      },
    ],
  };
});
</script>
