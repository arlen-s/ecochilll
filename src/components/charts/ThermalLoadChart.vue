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
    yAxis: {
      type: 'value' as const,
      name: 'kWth',
      ...commonAxis,
    },
    series: [
      {
        ...lineSeries(
          isCooling ? '制冷负荷' : '供热负荷',
          '#46b3ff',
          store.scenarioData.hourly.map((item) => item.thermalLoadKwTh),
        ),
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#ffd66b', width: 1.4, type: 'dashed' as const },
          label: { formatter: '当前回放', color: '#ffd66b' },
          data: [{ xAxis: currentHour }],
        },
      },
      lineSeries(
        isCooling ? '机组直供冷量' : '机组直供热量',
        '#c68cff',
        store.scenarioData.hourly.map((item) => item.plantDirectThermalKwTh),
      ),
      lineSeries(
        isCooling ? '水罐放冷' : '水罐放热',
        '#15f5ba',
        store.scenarioData.hourly.map((item) => item.storageDischargeKwTh),
      ),
    ],
  };
});
</script>
