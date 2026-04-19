<template>
  <div class="left-panel panel-grid">
    <SectionCard title="光伏发电模块" eyebrow="PHOTOVOLTAIC" accent="green">
      <template #actions>
        <span class="metric-chip">发电效率 {{ live.photovoltaic.efficiencyPct.toFixed(1) }}%</span>
      </template>

      <div class="metric-stack">
        <article class="metric-row">
          <span>当前发电功率</span>
          <strong>{{ live.photovoltaic.powerKw }} kW</strong>
        </article>
        <article class="metric-row">
          <span>日累计发电量</span>
          <strong>{{ live.photovoltaic.todayGenerationKwh }} kWh</strong>
        </article>
        <article class="metric-row">
          <span>太阳辐照强度</span>
          <strong>{{ live.photovoltaic.irradianceWm2 }} W/m²</strong>
        </article>
        <article class="metric-row">
          <span>发电波动</span>
          <strong>{{ live.photovoltaic.fluctuationPct.toFixed(1) }}%</strong>
        </article>
      </div>
    </SectionCard>

    <SectionCard title="天气环境模块" eyebrow="ENVIRONMENT" accent="cyan">
      <div class="weather-panel">
        <div class="weather-globe">
          <span>{{ live.weather.weatherText }}</span>
          <strong>{{ live.weather.ambientTempC.toFixed(1) }}℃</strong>
        </div>
        <div class="weather-list">
          <article>
            <span>云量</span>
            <strong>{{ live.weather.cloudCoverPct }}%</strong>
          </article>
          <article>
            <span>湿度</span>
            <strong>{{ live.weather.humidityPct.toFixed(0) }}%</strong>
          </article>
          <article>
            <span>风速</span>
            <strong>{{ live.weather.windSpeedMs.toFixed(1) }}m/s</strong>
          </article>
          <article>
            <span>舒适度</span>
            <strong>{{ live.weather.comfortIndex.toFixed(0) }}</strong>
          </article>
        </div>
      </div>
    </SectionCard>

    <SectionCard title="发电趋势折线图" eyebrow="PV CURVE" accent="green">
      <div class="chart-wrap">
        <GenerationTrendChart />
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GenerationTrendChart from '@/components/charts/GenerationTrendChart.vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const live = computed(() => store.liveSnapshot);
</script>

<style scoped lang="scss">
.metric-stack {
  display: grid;
  gap: 10px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(3, 13, 27, 0.46);
  border: 1px solid rgba(61, 225, 255, 0.1);
}

.metric-row span {
  color: rgba(220, 239, 255, 0.56);
  font-size: 12px;
}

.metric-row strong {
  font-size: 18px;
}

.weather-panel {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
}

.weather-globe {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 110px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.8), transparent 22%),
    radial-gradient(circle at 50% 45%, rgba(61, 225, 255, 0.26), rgba(70, 179, 255, 0.12) 55%, transparent 70%);
  border: 1px solid rgba(61, 225, 255, 0.2);
  text-align: center;
}

.weather-globe span {
  color: rgba(220, 239, 255, 0.64);
  font-size: 12px;
}

.weather-globe strong {
  margin-top: 6px;
  font-size: 24px;
}

.weather-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.weather-list article {
  padding: 10px;
  border-radius: 14px;
  background: rgba(3, 13, 27, 0.42);
  border: 1px solid rgba(61, 225, 255, 0.1);
}

.weather-list span {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.52);
  font-size: 12px;
}

.weather-list strong {
  font-size: 16px;
}

.chart-wrap {
  min-height: 11rem;
}

.left-panel {
  height: 100%;
  min-height: 0;
  grid-template-rows: repeat(3, minmax(0, auto));
}

.left-panel > * {
  min-height: 0;
}

@media (max-width: 1440px) {
  .left-panel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .left-panel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .weather-panel,
  .weather-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .weather-globe {
    min-height: 96px;
    border-radius: 24px;
  }
}
</style>
