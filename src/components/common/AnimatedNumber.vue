<template>
  <span>{{ prefix }}{{ displayText }}{{ suffix }}</span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { formatNumber } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    value: number;
    digits?: number;
    prefix?: string;
    suffix?: string;
    duration?: number;
  }>(),
  {
    digits: 0,
    prefix: '',
    suffix: '',
    duration: 800,
  },
);

const animatedValue = ref(props.value);
let frame = 0;

const animateTo = (target: number) => {
  cancelAnimationFrame(frame);
  const start = animatedValue.value;
  const startTime = performance.now();

  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / props.duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    animatedValue.value = start + (target - start) * eased;

    if (progress < 1) {
      frame = requestAnimationFrame(step);
    }
  };

  frame = requestAnimationFrame(step);
};

watch(
  () => props.value,
  (value) => animateTo(value),
  { immediate: true },
);

const displayText = computed(() => formatNumber(animatedValue.value, props.digits));

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
});
</script>
