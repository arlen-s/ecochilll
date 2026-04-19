<template>
  <SectionCard title="AI 调度策略引擎" eyebrow="AI DISPATCH" accent="green">
    <template #actions>
      <span class="metric-chip">{{ ai.status }}</span>
    </template>

    <div class="ai-header">
      <div>
        <h4>{{ ai.title }}</h4>
        <p>{{ ai.summary }}</p>
      </div>
      <div class="confidence">
        <span>策略置信度</span>
        <strong>{{ ai.confidencePct }}%</strong>
      </div>
    </div>

    <div class="ai-outcome">
      <div class="outcome-item">
        <span>预期收益</span>
        <strong>¥{{ ai.expectedBenefitCny }}</strong>
      </div>
      <div class="outcome-item">
        <span>预期减碳</span>
        <strong>{{ ai.expectedCarbonKg }} kg</strong>
      </div>
      <div class="outcome-item outcome-item--wide">
        <span>策略说明</span>
        <strong>{{ ai.recommendation }}</strong>
      </div>
    </div>

    <div class="rule-list">
      <article v-for="rule in ai.strategyRules" :key="rule.id" class="rule-card">
        <div class="rule-card__head">
          <h5>{{ rule.title }}</h5>
          <span>{{ rule.score }}分</span>
        </div>
        <div class="rule-track">
          <div class="rule-track__bar" :style="{ width: `${rule.score}%` }"></div>
        </div>
        <p>{{ rule.description }}</p>
        <footer>
          <span>节能 {{ rule.expectedSavingPct.toFixed(1) }}%</span>
          <span>收益 ¥{{ rule.expectedBenefitCny }}</span>
        </footer>
      </article>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SectionCard from '@/components/layout/SectionCard.vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const ai = computed(() => store.scenarioData.ai);
</script>

<style scoped lang="scss">
.ai-header {
  display: grid;
  grid-template-columns: 1fr 118px;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-header h4 {
  margin: 0 0 6px;
  font-size: 18px;
}

.ai-header p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.5;
  font-size: 13px;
}

.confidence {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 16px;
  background: rgba(21, 245, 186, 0.08);
  border: 1px solid rgba(21, 245, 186, 0.2);
}

.confidence span {
  font-size: 11px;
  color: rgba(220, 239, 255, 0.54);
}

.confidence strong {
  margin-top: 4px;
  font-size: 28px;
  color: var(--green);
}

.ai-outcome {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.outcome-item {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(4, 12, 24, 0.4);
  border: 1px solid rgba(61, 225, 255, 0.12);
}

.outcome-item--wide {
  grid-column: 1 / -1;
}

.outcome-item span {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.54);
  font-size: 12px;
}

.outcome-item strong {
  font-size: 15px;
  line-height: 1.5;
}

.rule-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.rule-card {
  padding: 10px;
  border-radius: 14px;
  background: rgba(5, 15, 28, 0.56);
  border: 1px solid rgba(21, 245, 186, 0.1);
}

.rule-card__head,
.rule-card footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-card__head h5 {
  margin: 0;
  font-size: 14px;
}

.rule-card__head span,
.rule-card footer span {
  font-size: 12px;
  color: rgba(220, 239, 255, 0.6);
}

.rule-track {
  margin: 10px 0 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(61, 225, 255, 0.08);
  overflow: hidden;
}

.rule-track__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #15f5ba, #46b3ff);
  box-shadow: 0 0 18px rgba(21, 245, 186, 0.28);
}

.rule-card p {
  margin: 0 0 8px;
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1200px) {
  .ai-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .confidence {
    min-height: 92px;
  }

  .rule-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .ai-outcome,
  .rule-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .rule-card__head,
  .rule-card footer {
    flex-wrap: wrap;
    gap: 6px;
  }
}
</style>
