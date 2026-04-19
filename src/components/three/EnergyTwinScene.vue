<template>
  <section class="scene-card glass-card">
    <div ref="sceneRoot" class="scene-root"></div>

    <div class="scene-overlay scene-overlay--top">
      <div class="scene-top-left">
        <div class="view-switch">
          <button
            v-for="item in focusOptions"
            :key="item.value"
            :class="['view-switch__btn', { 'view-switch__btn--active': store.focus === item.value }]"
            @click="store.setFocus(item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <div v-if="store.presentationActive || store.presentationPaused" class="scene-story">
          <small>当前答辩章节</small>
          <strong>{{ store.currentChapter?.title }}</strong>
        </div>
      </div>
      <div class="scene-top-right">
        <div class="zoom-controls">
          <button class="zoom-controls__btn" type="button" aria-label="放大场景" @click="sceneApi?.zoomIn()">+</button>
          <button class="zoom-controls__btn" type="button" aria-label="缩小场景" @click="sceneApi?.zoomOut()">-</button>
          <button class="zoom-controls__btn zoom-controls__btn--wide" type="button" @click="sceneApi?.resetZoom()">重置</button>
        </div>
        <div class="legend">
          <span><i class="legend__dot legend__dot--green"></i> 光伏直供</span>
          <span><i class="legend__dot legend__dot--blue"></i> 协同输能</span>
          <span><i class="legend__dot legend__dot--yellow"></i> 储能削峰</span>
        </div>
        <div class="scene-alerts">
          <article
            v-for="alert in sceneAlerts"
            :key="alert.id"
            :class="['scene-alert', `scene-alert--${alert.level}`]"
            @click="store.focusAlert(alert)"
          >
            <strong>{{ alert.title }}</strong>
          </article>
        </div>
      </div>
    </div>

    <div class="scene-overlay scene-overlay--bottom">
      <article class="scene-kpi">
        <small>绿电占比</small>
        <strong>{{ store.liveSnapshot.coreKpi.greenEnergyRatioPct.toFixed(1) }}%</strong>
      </article>
      <article class="scene-kpi">
        <small>网购电功率</small>
        <strong>{{ store.liveSnapshot.gridImportKw }} kW</strong>
      </article>
      <article class="scene-kpi scene-kpi--wide">
        <small>选中模块</small>
        <strong>{{ store.selectedNode.label }} / {{ store.selectedNode.state }}</strong>
        <p>{{ store.selectedNode.detail }}</p>
      </article>
    </div>

    <div v-if="hoverTip" class="scene-tooltip" :style="{ left: `${hoverTip.x}px`, top: `${hoverTip.y}px` }">
      {{ hoverTip.label }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createEnergyScene } from '@/three/createEnergyScene';
import { useDashboardStore } from '@/store/dashboard';
import type { FocusView, ScenarioMode } from '@/types/energy';

const store = useDashboardStore();
const sceneRoot = ref<HTMLElement | null>(null);
const hoverTip = ref<{ id: string; label: string; x: number; y: number } | null>(null);
const sceneAlerts = ref(store.activeAlerts.slice(0, 2));

const focusOptions: Array<{ label: string; value: FocusView }> = [
  { label: '总览视角', value: 'overview' },
  { label: '光伏视角', value: 'pv' },
  { label: '空调视角', value: 'ac' },
  { label: '储能视角', value: 'storage' },
];

let sceneApi:
  | {
      resize: () => void;
      setFocus: (focus: FocusView) => void;
      zoomIn: () => void;
      zoomOut: () => void;
      resetZoom: () => void;
      updateScenario: (scenario: ScenarioMode) => void;
      updateAlerts: (nodeIds: string[]) => void;
      updateSelected: (id: string) => void;
      dispose: () => void;
    }
  | null = null;

const handleResize = () => sceneApi?.resize();

onMounted(() => {
  if (!sceneRoot.value) return;

  sceneApi = createEnergyScene(sceneRoot.value, {
    onHover: (payload) => {
      hoverTip.value = payload;
    },
    onSelect: (id) => {
      store.selectNode(id, { openDetail: true });
    },
  });

  sceneApi.updateScenario(store.scenario);
  sceneApi.setFocus(store.focus);
  sceneApi.updateAlerts(store.activeAlerts.map((item) => item.nodeId));
  sceneApi.updateSelected(store.selectedNodeId);
  window.addEventListener('resize', handleResize);
});

watch(
  () => store.focus,
  (value) => sceneApi?.setFocus(value),
);

watch(
  () => store.scenario,
  (value) => sceneApi?.updateScenario(value),
);

watch(
  () => store.activeAlerts,
  (value) => {
    sceneAlerts.value = value.slice(0, 2);
    sceneApi?.updateAlerts(value.map((item) => item.nodeId));
  },
  { deep: true, immediate: true },
);

watch(
  () => store.selectedNodeId,
  (value) => sceneApi?.updateSelected(value),
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  sceneApi?.dispose();
});
</script>

<style scoped lang="scss">
.scene-card {
  position: relative;
  height: 100%;
  min-height: 460px;
  border-radius: 24px;
}

.scene-root {
  width: 100%;
  height: 100%;
}

.scene-overlay {
  position: absolute;
  left: 18px;
  right: 18px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}

.scene-overlay--top {
  top: 18px;
}

.scene-overlay--bottom {
  bottom: 18px;
  align-items: end;
  gap: 12px;
}

.scene-top-left,
.scene-top-right {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}

.view-switch,
.zoom-controls,
.legend,
.scene-alerts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  pointer-events: auto;
}

.view-switch__btn {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  background: rgba(7, 18, 35, 0.7);
  color: rgba(230, 247, 255, 0.84);
  cursor: pointer;
  transition: 0.2s ease;
}

.view-switch__btn--active,
.view-switch__btn:hover {
  border-color: rgba(21, 245, 186, 0.48);
  box-shadow: 0 0 18px rgba(21, 245, 186, 0.18);
}

.zoom-controls {
  gap: 8px;
}

.zoom-controls__btn {
  min-width: 38px;
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  background: rgba(7, 18, 35, 0.78);
  color: rgba(230, 247, 255, 0.9);
  cursor: pointer;
  transition: 0.2s ease;
}

.zoom-controls__btn:hover {
  border-color: rgba(21, 245, 186, 0.48);
  box-shadow: 0 0 18px rgba(21, 245, 186, 0.18);
}

.zoom-controls__btn--wide {
  min-width: 64px;
}

.legend {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(7, 18, 35, 0.7);
  border: 1px solid rgba(61, 225, 255, 0.12);
  color: rgba(230, 247, 255, 0.7);
  font-size: 12px;
}

.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scene-story {
  max-width: 280px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(7, 18, 35, 0.74);
  border: 1px solid rgba(21, 245, 186, 0.18);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.scene-story small {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.5);
  font-size: 11px;
  letter-spacing: 0.12em;
}

.scene-story strong {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.legend__dot--green {
  background: #15f5ba;
}

.legend__dot--blue {
  background: #3de1ff;
}

.legend__dot--yellow {
  background: #ffd66b;
}

.scene-alerts {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
}

.scene-alert {
  min-width: 120px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(7, 18, 35, 0.76);
  border: 1px solid rgba(61, 225, 255, 0.12);
  text-align: left;
  color: inherit;
  cursor: pointer;
  animation: pulse 1.9s ease-in-out infinite;
}

.scene-alert strong,
.scene-alert span {
  display: block;
}

.scene-alert strong {
  font-size: 11px;
  white-space: nowrap;
}

.scene-alert--high {
  border-color: rgba(255, 111, 145, 0.34);
}

.scene-alert--medium {
  border-color: rgba(255, 214, 107, 0.3);
}

.scene-alert--info {
  border-color: rgba(21, 245, 186, 0.2);
}

.scene-kpi {
  min-width: 120px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(7, 18, 35, 0.72);
  border: 1px solid rgba(61, 225, 255, 0.14);
  backdrop-filter: blur(10px);
}

.scene-kpi--wide {
  min-width: 280px;
  max-width: 360px;
  margin-left: auto;
}

.scene-kpi small {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.5);
  font-size: 11px;
  letter-spacing: 0.12em;
}

.scene-kpi strong {
  display: block;
  font-size: 18px;
}

.scene-kpi p {
  margin: 6px 0 0;
  color: rgba(220, 239, 255, 0.62);
  font-size: 12px;
  line-height: 1.45;
}

.scene-tooltip {
  position: absolute;
  transform: translate(14px, -14px);
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(7, 18, 35, 0.92);
  border: 1px solid rgba(61, 225, 255, 0.18);
  color: #ffffff;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

@media (max-width: 1440px) {
  .scene-card {
    min-height: 40rem;
  }
}

@media (max-width: 1180px) {
  .scene-overlay {
    left: 14px;
    right: 14px;
  }

  .scene-overlay--top {
    flex-direction: column;
    align-items: stretch;
  }

  .scene-top-right {
    justify-content: space-between;
  }

  .legend,
  .scene-alerts {
    display: none;
  }

  .scene-overlay--bottom {
    flex-wrap: wrap;
  }

  .scene-kpi--wide {
    min-width: 0;
    max-width: none;
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 720px) {
  .scene-card {
    min-height: 32rem;
  }

  .scene-overlay {
    left: 12px;
    right: 12px;
  }

  .scene-overlay--bottom {
    bottom: 12px;
  }

  .view-switch__btn,
  .zoom-controls__btn,
  .scene-story,
  .scene-kpi {
    width: 100%;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 0 rgba(61, 225, 255, 0);
  }

  50% {
    transform: translateY(-1px);
    box-shadow: 0 0 18px rgba(61, 225, 255, 0.12);
  }
}
</style>
