<template>
  <div ref="container" class="chart"></div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  option: echarts.EChartsOption;
}>();

const container = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;

const render = () => {
  if (!container.value) return;

  if (!chart) {
    chart = echarts.init(container.value, undefined, {
      renderer: 'canvas',
    });
  }

  chart.setOption(props.option, true);
};

onMounted(() => {
  render();
  if (container.value) {
    observer = new ResizeObserver(() => {
      chart?.resize();
    });
    observer.observe(container.value);
  }
});

watch(
  () => props.option,
  () => render(),
  { deep: true },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  height: 100%;
  min-height: 180px;
}
</style>
