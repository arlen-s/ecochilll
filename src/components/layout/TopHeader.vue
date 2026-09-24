<template>
  <header class="top-header glass-card">
    <div class="top-header__brand">
      <div class="brand-mark"></div>
      <div>
        <p>智慧校园 / 双碳目标 / 数字孪生演示平台</p>
        <h1>光枢匠调系统</h1>
      </div>
    </div>

    <div class="top-header__center">
      <div class="system-status">
        <span class="status-dot"></span>
        <span>{{ store.scenarioData.scenarioLabel }}</span>
        <span class="divider"></span>
        <span>{{ store.liveSnapshot.hourLabel }} 动态回放</span>
        <span class="divider"></span>
        <span>{{ store.liveSnapshot.weather.weatherText }}</span>
        <span class="divider"></span>
        <span>{{ runtimeLabel }}</span>
      </div>
      <p class="summary">{{ store.scenarioData.scenarioSummary }}</p>
    </div>

    <div class="top-header__time">
      <div class="clock">{{ nowText }}</div>
      <div class="meta">
        <span>{{ dateText }}</span>
        <span>{{ weatherText }}</span>
      </div>
    </div>

    <div class="top-header__kpis">
      <article v-for="item in kpis" :key="item.label" class="kpi-card">
        <small>{{ item.label }}</small>
        <strong>
          <AnimatedNumber :value="item.value" :digits="item.digits" :prefix="item.prefix" :suffix="item.suffix" />
        </strong>
      </article>
    </div>

    <div class="top-header__scenes">
      <div class="season-control" role="group" aria-label="切换水蓄能季节模式" :aria-busy="store.loading">
        <button
          v-for="item in operationModes"
          :key="item.value"
          type="button"
          :class="['season-control__button', { 'season-control__button--active': item.value === store.operationMode }]"
          :aria-pressed="item.value === store.operationMode"
          :disabled="store.loading"
          @click="store.setOperationMode(item.value)"
        >
          <span>{{ item.season }}</span>
          <small>{{ item.storage }}</small>
        </button>
      </div>

      <button
        v-for="item in scenarios"
        :key="item.value"
        type="button"
        :class="['scene-chip', { 'scene-chip--active': item.value === store.scenario }]"
        :disabled="store.loading"
        @click="store.setScenario(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AnimatedNumber from '@/components/common/AnimatedNumber.vue';
import { useDashboardStore } from '@/store/dashboard';
import type { OperatingMode, ScenarioMode } from '@/types/energy';

const store = useDashboardStore();

const scenarios = computed<Array<{ label: string; value: ScenarioMode }>>(() => [
  { label: '正常模式', value: 'normal' },
  {
    label: store.operationMode === 'heating' ? '寒潮模式' : '高温模式',
    value: 'heatwave',
  },
  { label: '云遮挡模式', value: 'cloudy' },
  { label: '高峰电价', value: 'peakPricing' },
]);

const operationModes: Array<{ season: string; storage: string; value: OperatingMode }> = [
  { season: '制冷季', storage: '水蓄冷', value: 'cooling' },
  { season: '供热季', storage: '水蓄热', value: 'heating' },
];

const dateText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(store.currentTime),
);

const nowText = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(store.currentTime),
);

const weatherText = computed(
  () =>
    `${store.liveSnapshot.weather.ambientTempC.toFixed(1)}℃ / 湿度 ${store.liveSnapshot.weather.humidityPct.toFixed(0)}% / 光照 ${store.liveSnapshot.weather.irradianceWm2}W/m²`,
);

const runtimeLabel = computed(() =>
  store.runtimeMeta.dataSource === 'api' ? '实时接口链路' : 'Mock 演示链路',
);

const kpis = computed(() => [
  { label: '当前总功率', value: store.liveSnapshot.coreKpi.totalPowerKw, suffix: ' kW', digits: 0, prefix: '' },
  { label: '峰值削减率', value: store.liveSnapshot.coreKpi.peakReductionPct, suffix: ' %', digits: 1, prefix: '' },
  { label: '碳减排', value: store.liveSnapshot.coreKpi.carbonReductionKg, suffix: ' kg', digits: 0, prefix: '' },
  { label: '经济收益', value: store.liveSnapshot.coreKpi.economicGainCny, suffix: '', digits: 0, prefix: '¥' },
]);
</script>

<style scoped lang="scss">
.top-header {
  display: grid;
  grid-template-columns: 360px 1fr 240px;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 24px;
}

.top-header__brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(61, 225, 255, 0.86), rgba(21, 245, 186, 0.2)),
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), transparent 30%);
  box-shadow: 0 0 24px rgba(61, 225, 255, 0.35);
}

.top-header__brand p,
.summary {
  margin: 0;
  color: rgba(220, 239, 255, 0.66);
  font-size: 12px;
  letter-spacing: 0.12em;
}

.top-header__brand h1 {
  margin: 6px 0 0;
  font-size: 28px;
  letter-spacing: 0.12em;
}

.top-header__center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.system-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--cyan);
  font-size: 13px;
  letter-spacing: 0.08em;
}

.divider {
  width: 1px;
  height: 12px;
  background: rgba(145, 205, 255, 0.2);
}

.top-header__time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
}

.clock {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  color: rgba(220, 239, 255, 0.66);
  font-size: 12px;
}

.top-header__kpis {
  grid-column: 1 / span 2;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  padding: 12px 14px;
  border: 1px solid rgba(61, 225, 255, 0.15);
  border-radius: 16px;
  background: rgba(4, 12, 24, 0.38);
}

.kpi-card small {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.56);
  letter-spacing: 0.12em;
}

.kpi-card strong {
  font-size: 26px;
  font-weight: 700;
  color: white;
}

.top-header__scenes {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  grid-column: 3;
  align-items: center;
}

.season-control {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 3px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  border-radius: 14px;
  background: rgba(4, 12, 24, 0.52);
}

.season-control__button {
  min-width: 74px;
  padding: 5px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(230, 247, 255, 0.62);
  cursor: pointer;
  transition: 0.2s ease;
}

.season-control__button span,
.season-control__button small {
  display: block;
}

.season-control__button span {
  font-size: 12px;
  font-weight: 700;
}

.season-control__button small {
  margin-top: 2px;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.season-control__button:hover:not(:disabled),
.season-control__button--active {
  background: rgba(21, 245, 186, 0.12);
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(21, 245, 186, 0.3);
}

.season-control__button:focus-visible,
.scene-chip:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 2px;
}

.scene-chip {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  background: rgba(10, 25, 42, 0.7);
  color: rgba(230, 247, 255, 0.82);
  cursor: pointer;
  transition: 0.2s ease;
}

.scene-chip:hover,
.scene-chip--active {
  border-color: rgba(21, 245, 186, 0.5);
  color: #ffffff;
  box-shadow: 0 0 18px rgba(21, 245, 186, 0.18);
}

.scene-chip:disabled,
.season-control__button:disabled {
  cursor: wait;
  opacity: 0.62;
}

@media (max-width: 1500px) {
  .top-header {
    grid-template-columns: 1fr;
  }

  .top-header__kpis,
  .top-header__scenes {
    grid-column: auto;
  }

  .top-header__time {
    align-items: flex-start;
  }

  .meta {
    justify-content: flex-start;
  }
}

@media (max-width: 1120px) {
  .top-header {
    padding: 16px;
    gap: 14px;
  }

  .top-header__brand {
    align-items: flex-start;
  }

  .top-header__brand h1 {
    font-size: 24px;
    line-height: 1.2;
  }

  .top-header__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .top-header {
    padding: 14px;
  }

  .top-header__brand {
    flex-direction: column;
  }

  .top-header__brand h1 {
    font-size: 20px;
  }

  .clock {
    font-size: 28px;
  }

  .top-header__kpis {
    grid-template-columns: minmax(0, 1fr);
  }

  .scene-chip {
    width: 100%;
    justify-content: center;
  }

  .season-control {
    width: 100%;
  }
}

@media (min-width: 1800px) and (min-height: 1000px) {
  .top-header {
    grid-template-columns: 300px minmax(0, 1fr) 500px;
    grid-template-rows: auto auto;
    gap: 8px;
    padding: 10px 14px;
  }

  .brand-mark {
    width: 40px;
    height: 40px;
  }

  .top-header__brand h1 {
    font-size: 24px;
  }

  .system-status {
    gap: 6px;
    font-size: 11px;
  }

  .summary {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11px;
  }

  .clock {
    font-size: 26px;
  }

  .kpi-card {
    padding: 6px 10px;
  }

  .kpi-card small {
    margin-bottom: 2px;
  }

  .kpi-card strong {
    font-size: 20px;
  }

  .top-header__scenes {
    flex-wrap: nowrap;
    gap: 5px;
  }

  .season-control__button {
    min-width: 65px;
    padding: 3px 5px;
  }

  .scene-chip {
    height: 32px;
    padding: 0 8px;
    white-space: nowrap;
    font-size: 11px;
  }
}
</style>
