<template>
  <main class="dashboard-shell">
    <TopHeader />
    <DashboardCommandBar />

    <section class="dashboard-main">
      <LeftPanel class="dashboard-main__left" />
      <EnergyTwinScene class="dashboard-main__scene" />
      <RightPanel class="dashboard-main__right" />
    </section>

    <BottomPanel />

    <EquipmentDetailModal />
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import DashboardCommandBar from '@/components/presentation/DashboardCommandBar.vue';
import TopHeader from '@/components/layout/TopHeader.vue';
import EquipmentDetailModal from '@/components/panels/EquipmentDetailModal.vue';
import BottomPanel from '@/components/panels/BottomPanel.vue';
import LeftPanel from '@/components/panels/LeftPanel.vue';
import RightPanel from '@/components/panels/RightPanel.vue';
import EnergyTwinScene from '@/components/three/EnergyTwinScene.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();

onMounted(() => {
  void store.initialize();
  store.start();
});

onBeforeUnmount(() => {
  store.stop();
});
</script>

<style scoped lang="scss">
.dashboard-shell {
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 14px;
  width: 100%;
  min-height: 100vh;
  padding: 14px 14px 96px;
}

.dashboard-main {
  min-height: 0;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr) 410px;
  gap: 14px;
  align-items: stretch;
}

@media (max-width: 1680px) {
  .dashboard-main {
    grid-template-columns: 290px minmax(0, 1fr) 360px;
  }
}

@media (max-width: 1440px) {
  .dashboard-main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'scene scene'
      'left right';
    align-items: start;
  }

  .dashboard-main__scene {
    grid-area: scene;
  }

  .dashboard-main__left {
    grid-area: left;
  }

  .dashboard-main__right {
    grid-area: right;
  }
}

@media (max-width: 1024px) {
  .dashboard-shell {
    padding: 12px 12px 88px;
    gap: 12px;
  }

  .dashboard-main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'scene'
      'left'
      'right';
  }
}

@media (max-width: 720px) {
  .dashboard-shell {
    padding: 10px 10px 82px;
    gap: 10px;
  }
}

@media (min-width: 1800px) and (min-height: 1000px) {
  .dashboard-shell {
    height: 100dvh;
    min-height: 0;
    padding: 10px;
    gap: 10px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
  }

  .dashboard-main {
    min-height: 0;
    gap: 10px;
    overflow: hidden;
  }

  .dashboard-main__left,
  .dashboard-main__right,
  .dashboard-main__scene {
    min-height: 0;
  }

  .dashboard-main :deep(.panel-grid) {
    gap: 8px;
  }

  .dashboard-main :deep(.section-card) {
    padding: 10px;
  }

  .dashboard-main :deep(.section-title) {
    margin-bottom: 6px;
  }
}
</style>
