<template>
  <SectionCard :title="terms.title" :eyebrow="terms.eyebrow" accent="green">
    <template #actions>
      <span :class="['metric-chip', `storage-state--${storage.state}`]">{{ stateLabel }}</span>
    </template>

    <div class="storage-level">
      <div class="storage-level__label">
        <span>{{ terms.level }}</span>
        <strong>{{ storage.storageLevelPct.toFixed(1) }}%</strong>
      </div>
      <div
        class="storage-level__track"
        role="progressbar"
        :aria-label="terms.level"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="storage.storageLevelPct"
      >
        <div class="storage-level__fill" :style="{ width: `${storage.storageLevelPct}%` }"></div>
      </div>
    </div>

    <div class="storage-metrics">
      <article class="storage-metric storage-metric--wide">
        <span>{{ terms.available }}</span>
        <strong>{{ storage.storedEnergyKwhTh.toFixed(1) }} kWhth</strong>
      </article>
      <article class="storage-metric">
        <span>{{ terms.charge }}</span>
        <strong>{{ storage.chargePowerKwTh.toFixed(1) }} kWth</strong>
      </article>
      <article class="storage-metric">
        <span>{{ terms.discharge }}</span>
        <strong>{{ storage.dischargePowerKwTh.toFixed(1) }} kWth</strong>
      </article>
      <article class="storage-metric">
        <span>供水温度</span>
        <strong>{{ storage.supplyTempC.toFixed(1) }}℃</strong>
      </article>
      <article class="storage-metric">
        <span>回水温度</span>
        <strong>{{ storage.returnTempC.toFixed(1) }}℃</strong>
      </article>
      <article class="storage-metric">
        <span>水罐容积</span>
        <strong>{{ storage.tankVolumeM3.toFixed(0) }} m³</strong>
      </article>
      <article class="storage-metric">
        <span>可用时长</span>
        <strong>{{ storage.availableHours.toFixed(1) }} h</strong>
      </article>
    </div>

    <button class="storage-detail" type="button" aria-label="查看水蓄能设备详细指标" @click="store.openDetail('storage')">
      查看设备详情
    </button>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const storage = computed(() => store.liveSnapshot.storage);

const terms = computed(() => store.operationMode === 'cooling'
  ? {
      title: '水蓄冷系统',
      eyebrow: 'CHILLED WATER STORAGE',
      level: '蓄冷水位',
      available: '可用冷量',
      charge: '充冷功率',
      discharge: '放冷功率',
    }
  : {
      title: '水蓄热系统',
      eyebrow: 'HOT WATER STORAGE',
      level: '蓄热水位',
      available: '可用热量',
      charge: '充热功率',
      discharge: '放热功率',
    });

const stateLabel = computed(() => {
  if (storage.value.state === 'charging') return store.operationMode === 'cooling' ? '充冷中' : '充热中';
  if (storage.value.state === 'discharging') return store.operationMode === 'cooling' ? '放冷中' : '放热中';
  return '保温待机';
});
</script>

<style scoped lang="scss">
.storage-level {
  margin-bottom: 10px;
}

.storage-level__label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 7px;
}

.storage-level__label span,
.storage-metric span {
  color: rgba(220, 239, 255, 0.56);
  font-size: 11px;
}

.storage-level__label strong {
  color: var(--green);
  font-size: 20px;
}

.storage-level__track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(61, 225, 255, 0.09);
  box-shadow: inset 0 0 0 1px rgba(61, 225, 255, 0.1);
}

.storage-level__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #46b3ff, #15f5ba);
  box-shadow: 0 0 16px rgba(21, 245, 186, 0.3);
  transition: width 0.3s ease;
}

.storage-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.storage-metric {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid rgba(61, 225, 255, 0.1);
  border-radius: 12px;
  background: rgba(3, 13, 27, 0.42);
}

.storage-metric--wide {
  grid-column: 1 / -1;
}

.storage-metric span,
.storage-metric strong {
  display: block;
}

.storage-metric strong {
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.storage-detail {
  width: 100%;
  min-height: 34px;
  margin-top: 10px;
  border: 1px solid rgba(21, 245, 186, 0.22);
  border-radius: 12px;
  background: rgba(21, 245, 186, 0.08);
  color: rgba(230, 247, 255, 0.88);
  cursor: pointer;
}

.storage-detail:hover,
.storage-detail:focus-visible {
  border-color: rgba(21, 245, 186, 0.48);
  box-shadow: 0 0 16px rgba(21, 245, 186, 0.14);
}

.storage-state--charging {
  color: var(--blue);
}

.storage-state--discharging {
  color: var(--green);
}

.storage-state--standby {
  color: var(--yellow);
}

@media (min-width: 1800px) and (min-height: 1000px) {
  .storage-level {
    margin-bottom: 6px;
  }

  .storage-level__label {
    margin-bottom: 4px;
  }

  .storage-level__label strong {
    font-size: 16px;
  }

  .storage-metrics {
    gap: 5px;
  }

  .storage-metric {
    padding: 6px 8px;
  }

  .storage-metric strong {
    margin-top: 2px;
    font-size: 12px;
  }

  .storage-metric:nth-last-child(-n + 4) {
    display: none;
  }

  .storage-detail {
    min-height: 30px;
    margin-top: 6px;
  }
}
</style>
