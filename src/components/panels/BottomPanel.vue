<template>
  <section v-if="desktopAnalysisVisible" class="bottom-panel" aria-label="综合趋势分析">
    <div class="bottom-panel__toolbar glass-card">
      <div>
        <small>ANALYSIS HUB</small>
        <strong>电、热、碳与经济指标分轴呈现</strong>
      </div>
      <div class="bottom-panel__toolbar-actions">
        <button class="panel-action-btn" type="button" @click="activePanel = 'revenue'">移峰节费分析</button>
        <button class="panel-action-btn" type="button" @click="activePanel = 'timeline'">AI 决策时间轴</button>
      </div>
    </div>

    <div class="bottom-panel__grid">
      <SectionCard title="24 小时电功率趋势" eyebrow="ELECTRIC POWER / kW" accent="cyan">
        <template #actions>
          <button class="panel-action-btn" type="button" @click="activePanel = 'power'">浮窗查看</button>
        </template>
        <div class="chart-card"><PowerTrendChart /></div>
      </SectionCard>

      <SectionCard :title="thermalLoadTitle" eyebrow="THERMAL LOAD / kWth" accent="cyan">
        <template #actions>
          <button class="panel-action-btn" type="button" @click="activePanel = 'thermalLoad'">浮窗查看</button>
        </template>
        <div class="chart-card"><ThermalLoadChart /></div>
      </SectionCard>

      <SectionCard :title="thermalStorageTitle" eyebrow="THERMAL STORAGE / kWth & %" accent="green">
        <template #actions>
          <button class="panel-action-btn" type="button" @click="activePanel = 'thermalStorage'">浮窗查看</button>
        </template>
        <div class="chart-card"><ThermalStorageChart /></div>
      </SectionCard>

      <SectionCard title="碳减排与峰值削减" eyebrow="CARBON / kg & PEAK / %" accent="green">
        <template #actions>
          <button class="panel-action-btn" type="button" @click="activePanel = 'saving'">浮窗查看</button>
        </template>
        <div class="chart-card"><SavingsCarbonChart /></div>
      </SectionCard>
    </div>
  </section>

  <nav v-else-if="oneScreenMode" class="bottom-panel-screen glass-card" aria-label="分析模块快捷入口">
    <strong>分析中心</strong>
    <button type="button" class="panel-action-btn" @click="activePanel = 'power'">电功率趋势</button>
    <button type="button" class="panel-action-btn" @click="activePanel = 'thermalLoad'">热负荷趋势</button>
    <button type="button" class="panel-action-btn" @click="activePanel = 'thermalStorage'">水蓄能趋势</button>
    <button type="button" class="panel-action-btn" @click="activePanel = 'saving'">碳与峰值分析</button>
    <button type="button" class="panel-action-btn" @click="activePanel = 'revenue'">移峰节费分析</button>
    <button type="button" class="panel-action-btn" @click="activePanel = 'timeline'">AI 决策时间轴</button>
  </nav>

  <SectionCard v-else class="bottom-panel-compact" title="更多分析模块" eyebrow="ANALYSIS HUB" accent="cyan">
    <template #actions>
      <span class="metric-chip">分类指标浮窗</span>
    </template>

    <p class="bottom-panel-compact__summary">
      电功率、热负荷、水蓄能、碳与峰值、经济收益和 AI 记录均可独立查看，避免单位混用。
    </p>

    <div class="bottom-panel-compact__actions">
      <button class="panel-action-btn" type="button" @click="activePanel = 'power'">电功率趋势</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'thermalLoad'">热负荷趋势</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'thermalStorage'">水蓄能趋势</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'saving'">碳与峰值分析</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'revenue'">移峰节费分析</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'timeline'">AI 决策时间轴</button>
    </div>
  </SectionCard>

  <FocusPanelModal
    :visible="activePanel === 'power'"
    title="24 小时电功率趋势"
    eyebrow="ELECTRIC POWER / kW"
    description="光伏、园区总电负荷、冷热源机组电功率与电网购电均按电功率 kW 展示。"
    @close="activePanel = null"
  >
    <div class="focus-chart"><PowerTrendChart /></div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'thermalLoad'"
    :title="thermalLoadTitle"
    eyebrow="THERMAL LOAD / kWth"
    :description="thermalLoadDescription"
    @close="activePanel = null"
  >
    <div class="focus-chart"><ThermalLoadChart /></div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'thermalStorage'"
    :title="thermalStorageTitle"
    eyebrow="THERMAL STORAGE / kWth & %"
    :description="thermalStorageDescription"
    @close="activePanel = null"
  >
    <div class="focus-chart"><ThermalStorageChart /></div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'saving'"
    title="碳减排与峰值削减"
    eyebrow="CARBON / kg & PEAK / %"
    description="碳减排量使用 kg 轴，峰值削减率使用百分比轴，便于区分环境与削峰成效。"
    @close="activePanel = null"
  >
    <div class="focus-chart"><SavingsCarbonChart /></div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'revenue'"
    title="峰谷电价与移峰节费"
    eyebrow="PRICE & COST SHIFTING"
    description="移峰节费保留正负金额，电价使用独立坐标轴，负值代表该时段相对基线增加成本。"
    @close="activePanel = null"
  >
    <div class="focus-chart"><RevenueTrendChart /></div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'timeline'"
    title="AI 决策记录时间轴"
    eyebrow="AI HISTORY"
    description="按时间查看系统已执行的水蓄能调度决策及对应收益说明。"
    @close="activePanel = null"
  >
    <AiTimelinePanel />
  </FocusPanelModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import PowerTrendChart from '@/components/charts/PowerTrendChart.vue';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart.vue';
import SavingsCarbonChart from '@/components/charts/SavingsCarbonChart.vue';
import ThermalLoadChart from '@/components/charts/ThermalLoadChart.vue';
import ThermalStorageChart from '@/components/charts/ThermalStorageChart.vue';
import FocusPanelModal from '@/components/common/FocusPanelModal.vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import AiTimelinePanel from '@/components/panels/AiTimelinePanel.vue';
import { useDashboardStore } from '@/store/dashboard';
import { isOneScreenViewport } from '@/layout/oneScreenMode';

type AnalysisPanel = 'power' | 'thermalLoad' | 'thermalStorage' | 'saving' | 'revenue' | 'timeline';

const store = useDashboardStore();
const activePanel = ref<AnalysisPanel | null>(null);
const desktopAnalysisVisible = ref(false);
const oneScreenMode = ref(false);
const isCooling = computed(() => store.operationMode === 'cooling');
const thermalLoadTitle = computed(() => isCooling.value ? '制冷负荷与供冷构成' : '供热负荷与供热构成');
const thermalStorageTitle = computed(() => isCooling.value ? '水蓄冷充放趋势' : '水蓄热充放趋势');
const thermalLoadDescription = computed(() => isCooling.value
  ? '制冷负荷、机组直供冷量与水罐放冷量统一使用热功率 kWth。'
  : '供热负荷、机组直供热量与水罐放热量统一使用热功率 kWth。');
const thermalStorageDescription = computed(() => isCooling.value
  ? '充冷与放冷功率使用 kWth，蓄冷水位使用独立百分比轴。'
  : '充热与放热功率使用 kWth，蓄热水位使用独立百分比轴。');

const syncLayoutMode = () => {
  oneScreenMode.value = isOneScreenViewport(window.innerWidth, window.innerHeight);
  desktopAnalysisVisible.value = window.innerWidth > 1440 && !oneScreenMode.value;
};

onMounted(() => {
  syncLayoutMode();
  window.addEventListener('resize', syncLayoutMode);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncLayoutMode);
});
</script>

<style scoped lang="scss">
.bottom-panel {
  display: grid;
  gap: 14px;
}

.bottom-panel-screen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 58px;
  padding: 8px 14px;
  padding-right: 190px;
  border-radius: 18px;
}

.bottom-panel-screen strong {
  white-space: nowrap;
  letter-spacing: 0.08em;
}

.bottom-panel-screen .panel-action-btn {
  flex: 1;
  white-space: nowrap;
}

.bottom-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 18px;
}

.bottom-panel__toolbar small,
.bottom-panel__toolbar strong {
  display: block;
}

.bottom-panel__toolbar small {
  margin-bottom: 4px;
  color: var(--text-soft);
  font-size: 11px;
  letter-spacing: 0.14em;
}

.bottom-panel__toolbar-actions,
.bottom-panel-compact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.bottom-panel__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.chart-card {
  height: 210px;
}

.focus-chart {
  height: min(30rem, 62vh);
  min-height: 20rem;
}

.bottom-panel-compact__summary {
  margin: 0 0 0.875rem;
  color: var(--text-soft);
  line-height: 1.6;
}

@media (max-width: 1800px) {
  .bottom-panel__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .focus-chart {
    min-height: 17rem;
  }

  .bottom-panel-compact__actions {
    flex-direction: column;
  }
}
</style>
