<template>
  <SectionCard title="AI 决策记录时间轴" eyebrow="AI HISTORY" accent="yellow">
    <div class="timeline">
      <article v-for="item in timeline" :key="`${item.time}-${item.title}`" class="timeline-item">
        <div class="timeline-item__time">{{ item.time }}</div>
        <div class="timeline-item__dot" :class="`timeline-item__dot--${item.level}`"></div>
        <div class="timeline-item__content">
          <h4>{{ item.title }}</h4>
          <p>{{ item.summary }}</p>
          <strong>{{ item.benefit }}</strong>
        </div>
      </article>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const timeline = computed(() => store.scenarioData.ai.timeline);
</script>

<style scoped lang="scss">
.timeline {
  display: grid;
  gap: 10px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 54px 18px 1fr;
  gap: 10px;
  align-items: start;
}

.timeline-item__time {
  color: rgba(220, 239, 255, 0.52);
  font-size: 12px;
  letter-spacing: 0.06em;
  padding-top: 2px;
}

.timeline-item__dot {
  position: relative;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  border-radius: 50%;
  background: #46b3ff;
  box-shadow: 0 0 12px rgba(70, 179, 255, 0.4);
}

.timeline-item__dot::after {
  content: '';
  position: absolute;
  top: 14px;
  left: 50%;
  width: 1px;
  height: calc(100% + 16px);
  transform: translateX(-50%);
  background: rgba(145, 205, 255, 0.16);
}

.timeline-item:last-child .timeline-item__dot::after {
  display: none;
}

.timeline-item__dot--high {
  background: #15f5ba;
  box-shadow: 0 0 14px rgba(21, 245, 186, 0.5);
}

.timeline-item__dot--medium {
  background: #ffd66b;
  box-shadow: 0 0 14px rgba(255, 214, 107, 0.38);
}

.timeline-item__content {
  padding-bottom: 4px;
}

.timeline-item__content h4 {
  margin: 0 0 4px;
  font-size: 14px;
}

.timeline-item__content p {
  margin: 0 0 4px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.45;
}

.timeline-item__content strong {
  color: #ffffff;
  font-size: 12px;
}

@media (max-width: 720px) {
  .timeline-item {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .timeline-item__dot::after {
    display: none;
  }
}
</style>
