<template>
  <section class="section-card glass-card" :class="accentClass">
    <header class="section-title">
      <div>
        <small>{{ eyebrow }}</small>
        <h3>{{ title }}</h3>
      </div>
      <slot name="actions" />
    </header>
    <div class="section-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    accent?: 'cyan' | 'green' | 'yellow';
  }>(),
  {
    eyebrow: 'MODULE',
    accent: 'cyan',
  },
);

const accentClass = computed(() => `section-card--${props.accent}`);
</script>

<style scoped lang="scss">
.section-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px;
  border-radius: 18px;
}

.section-card__body {
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
}

header.section-title {
  gap: 12px;
}

small {
  display: block;
  margin-bottom: 4px;
  color: rgba(217, 238, 255, 0.5);
  font-size: 11px;
  letter-spacing: 0.18em;
}

.section-card--cyan {
  border-color: rgba(61, 225, 255, 0.2);
}

.section-card--green {
  border-color: rgba(21, 245, 186, 0.2);
}

.section-card--yellow {
  border-color: rgba(255, 214, 107, 0.22);
}

@media (max-width: 720px) {
  .section-card {
    padding: 14px;
  }

  header.section-title {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
