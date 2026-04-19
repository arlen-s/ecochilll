<template>
  <div class="right-panel panel-grid">
    <SectionCard title="空调负荷与舒适度" eyebrow="HVAC LOAD" accent="cyan">
      <div class="headline">
        <div>
          <small>当前运行状态</small>
          <strong>{{ live.airConditioning.runningStatus }}</strong>
        </div>
        <div class="comfort-pill">舒适度 {{ live.airConditioning.comfortPct.toFixed(0) }}%</div>
      </div>

      <div class="zone-list">
        <article v-for="zone in live.airConditioning.zones" :key="zone.id">
          <header>
            <h4>{{ zone.name }}</h4>
            <span>{{ zone.loadKw }} kW</span>
          </header>
          <div class="zone-meta">
            <span>{{ zone.indoorTempC.toFixed(1) }}℃ / {{ zone.humidityPct.toFixed(0) }}%</span>
            <span>{{ zone.status }}</span>
            <span>舒适 {{ zone.comfortPct.toFixed(0) }}%</span>
          </div>
        </article>
      </div>

      <div class="load-chart">
        <LoadTrendChart />
      </div>
    </SectionCard>

    <div class="right-panel__focusable">
      <AiDecisionPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LoadTrendChart from '@/components/charts/LoadTrendChart.vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import AiDecisionPanel from '@/components/panels/AiDecisionPanel.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const live = computed(() => store.liveSnapshot);
</script>

<style scoped lang="scss">
.right-panel__focusable {
  position: relative;
}

.headline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.headline small {
  display: block;
  margin-bottom: 4px;
  color: rgba(220, 239, 255, 0.52);
}

.headline strong {
  font-size: 24px;
}

.comfort-pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(61, 225, 255, 0.08);
  border: 1px solid rgba(61, 225, 255, 0.18);
  color: var(--cyan);
  font-size: 13px;
}

.zone-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.zone-list article {
  padding: 12px;
  border-radius: 14px;
  background: rgba(3, 13, 27, 0.42);
  border: 1px solid rgba(61, 225, 255, 0.1);
}

.zone-list header,
.zone-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.zone-list h4 {
  margin: 0;
  font-size: 14px;
}

.zone-list header span,
.zone-meta span {
  color: rgba(220, 239, 255, 0.62);
  font-size: 12px;
}

.zone-meta {
  margin-top: 6px;
  flex-wrap: wrap;
  gap: 6px;
}

.load-chart {
  height: 120px;
}

.right-panel {
  height: 100%;
  min-height: 0;
  grid-template-rows: repeat(2, minmax(0, auto));
}

.right-panel > * {
  min-height: 0;
}

@media (max-width: 1024px) {
  .zone-list,
  .right-panel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .zone-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
