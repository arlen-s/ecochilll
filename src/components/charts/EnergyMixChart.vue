<template>
  <BaseChart :option="option" />
</template>

<script setup lang="ts">
import type { DashboardChartOption } from './chartTheme';
import { computed } from 'vue';
import BaseChart from './BaseChart.vue';
import { pieSeries, tooltipTheme } from './chartTheme';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();

const option = computed<DashboardChartOption>(() => ({
  tooltip: {
    ...tooltipTheme,
    trigger: 'item' as const,
  },
  series: [
    pieSeries(
      store.scenarioData.energyMix.map((item) => ({
        value: item.value,
        name: item.name,
        itemStyle: { color: item.color },
      })),
    ),
  ],
}));
</script>
