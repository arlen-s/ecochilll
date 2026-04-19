<template>
  <div class="bottom-panel">
    <SectionCard title="24 小时发电/耗电趋势" eyebrow="POWER TREND" accent="cyan">
      <template #actions>
        <button class="panel-action-btn" type="button" @click="activePanel = 'power'">浮窗查看</button>
      </template>

      <div class="chart-card">
        <PowerTrendChart />
      </div>
    </SectionCard>

    <SectionCard title="碳减排与节能分析" eyebrow="CARBON & SAVING" accent="green">
      <template #actions>
        <button class="panel-action-btn" type="button" @click="activePanel = 'saving'">浮窗查看</button>
      </template>

      <div class="chart-card">
        <SavingsCarbonChart />
      </div>
    </SectionCard>

    <SectionCard title="峰谷电价与调度收益" eyebrow="PRICE & REVENUE" accent="yellow">
      <template #actions>
        <button class="panel-action-btn" type="button" @click="activePanel = 'revenue'">浮窗查看</button>
      </template>

      <div class="chart-card">
        <RevenueTrendChart />
      </div>
    </SectionCard>

    <div class="timeline-preview">
      <AiTimelinePanel />
      <button class="panel-action-btn timeline-preview__action" type="button" @click="activePanel = 'timeline'">浮窗查看</button>
    </div>
  </div>

  <SectionCard class="bottom-panel-compact" title="更多分析模块" eyebrow="ANALYSIS HUB" accent="cyan">
    <template #actions>
      <span class="metric-chip">笔记本精简模式</span>
    </template>

    <div class="bottom-panel-compact__summary">
      <p>趋势图和时间轴已收纳，主界面优先给中间孪生场景让出空间。</p>
    </div>

    <div class="bottom-panel-compact__actions">
      <button class="panel-action-btn" type="button" @click="activePanel = 'power'">发电耗电趋势</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'saving'">碳减排分析</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'revenue'">收益分析</button>
      <button class="panel-action-btn" type="button" @click="activePanel = 'timeline'">AI 时间轴</button>
    </div>
  </SectionCard>

  <FocusPanelModal
    :visible="activePanel === 'power'"
    title="24 小时发电/耗电趋势"
    eyebrow="POWER TREND"
    description="笔记本上默认保留缩略预览，点击后在浮窗中看完整曲线和图例。"
    @close="activePanel = null"
  >
    <div class="focus-chart">
      <PowerTrendChart />
    </div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'saving'"
    title="碳减排与节能分析"
    eyebrow="CARBON & SAVING"
    description="适合放大查看柱线组合走势，避免在小屏里细节过密。"
    @close="activePanel = null"
  >
    <div class="focus-chart">
      <SavingsCarbonChart />
    </div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'revenue'"
    title="峰谷电价与调度收益"
    eyebrow="PRICE & REVENUE"
    description="放大后更容易查看当前回放标记、收益柱和电价线的关系。"
    @close="activePanel = null"
  >
    <div class="focus-chart">
      <RevenueTrendChart />
    </div>
  </FocusPanelModal>

  <FocusPanelModal
    :visible="activePanel === 'timeline'"
    title="AI 决策记录时间轴"
    eyebrow="AI HISTORY"
    description="时间轴属于解释型信息，在小屏里改为点击查看会更省空间。"
    @close="activePanel = null"
  >
    <AiTimelinePanel />
  </FocusPanelModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PowerTrendChart from '@/components/charts/PowerTrendChart.vue';
import RevenueTrendChart from '@/components/charts/RevenueTrendChart.vue';
import SavingsCarbonChart from '@/components/charts/SavingsCarbonChart.vue';
import FocusPanelModal from '@/components/common/FocusPanelModal.vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import AiTimelinePanel from '@/components/panels/AiTimelinePanel.vue';

const activePanel = ref<'power' | 'saving' | 'revenue' | 'timeline' | null>(null);
</script>

<style scoped lang="scss">
.timeline-preview {
  position: relative;
}

.timeline-preview__action {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 3;
}

.focus-chart {
  height: min(30rem, 62vh);
  min-height: 20rem;
}

.bottom-panel-compact__summary p {
  margin: 0 0 0.875rem;
  color: var(--text-soft);
  line-height: 1.6;
}

.bottom-panel-compact__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.bottom-panel {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1.1fr;
  gap: 14px;
}

.chart-card {
  height: 188px;
}

@media (max-width: 1600px) {
  .bottom-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .bottom-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .chart-card {
    height: 170px;
  }
}

@media (max-width: 1440px) {
  .bottom-panel {
    display: none;
  }
}

@media (min-width: 1441px) {
  .bottom-panel-compact {
    display: none;
  }
}

@media (max-width: 720px) {
  .timeline-preview__action {
    position: static;
    margin-top: 0.75rem;
  }

  .focus-chart {
    min-height: 17rem;
  }

  .bottom-panel-compact__actions {
    flex-direction: column;
  }
}
</style>
