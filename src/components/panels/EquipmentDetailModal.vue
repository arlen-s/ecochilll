<template>
  <teleport to="body">
    <transition name="detail-fade">
      <div v-if="store.detailVisible" class="detail-modal" @click.self="store.closeDetail()">
        <div class="detail-modal__panel glass-card">
          <header class="detail-modal__header">
            <div>
              <small>{{ detail.subtitle }}</small>
              <h3>{{ detail.title }}</h3>
              <p>{{ store.selectedNode.detail }}</p>
            </div>

            <div class="detail-modal__meta">
              <div class="health-chip">
                <span>健康评分</span>
                <strong>{{ detail.healthScore }}</strong>
              </div>
              <button class="detail-close" @click="store.closeDetail()">关闭</button>
            </div>
          </header>

          <div class="detail-modal__body">
            <section class="detail-section">
              <div class="detail-section__title">
                <h4>核心指标</h4>
                <span>实时设备快照</span>
              </div>
              <div class="metric-grid">
                <article v-for="metric in detail.metrics" :key="metric.label" :class="{ 'metric-grid__item--emphasis': metric.emphasis }">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                </article>
              </div>
            </section>

            <section class="detail-section">
              <div class="detail-section__title">
                <h4>近时段趋势</h4>
                <span>用于答辩时解释调度变化</span>
              </div>
              <div class="preview-chart">
                <div
                  v-for="point in detail.preview"
                  :key="point.hour"
                  class="preview-chart__col"
                >
                  <div class="preview-chart__bar-wrap">
                    <div class="preview-chart__bar" :style="{ height: `${barHeight(point.value)}%` }"></div>
                  </div>
                  <strong>{{ point.value }}</strong>
                  <span>{{ point.hour }}</span>
                </div>
              </div>
            </section>

            <section class="detail-section">
              <div class="detail-section__title">
                <h4>AI 策略说明</h4>
                <span>{{ detail.strategyLink }}</span>
              </div>
              <div class="strategy-card">
                <p>{{ detail.recommendation }}</p>
                <div class="strategy-card__alerts">
                  <article v-for="alert in detail.relatedAlerts" :key="alert.id" :class="['strategy-alert', `strategy-alert--${alert.level}`]">
                    <strong>{{ alert.title }}</strong>
                    <span>{{ alert.metric }}: {{ alert.value }}</span>
                    <p>{{ alert.suggestion }}</p>
                  </article>
                  <div v-if="detail.relatedAlerts.length === 0" class="strategy-alert strategy-alert--stable">
                    <strong>运行稳定</strong>
                    <span>当前节点未触发重点告警</span>
                    <p>可继续按现有策略运行，重点观察后续负荷和环境变化。</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const detail = computed(() => store.selectedNodeDetail);

const barHeight = (value: number) => {
  const max = Math.max(...detail.value.preview.map((item) => item.value), 1);
  return Math.max(18, (value / max) * 100);
};
</script>

<style scoped lang="scss">
.detail-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(2, 10, 20, 0.72);
  backdrop-filter: blur(18px);
}

.detail-modal__panel {
  width: min(1180px, calc(100vw - 60px));
  max-height: min(88vh, 920px);
  padding: 24px;
  border-radius: 28px;
  overflow: auto;
}

.detail-modal__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.detail-modal__header small {
  display: block;
  margin-bottom: 6px;
  color: rgba(220, 239, 255, 0.56);
  font-size: 12px;
  letter-spacing: 0.14em;
}

.detail-modal__header h3 {
  margin: 0 0 6px;
  font-size: 28px;
}

.detail-modal__header p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.55;
  max-width: 700px;
}

.detail-modal__meta {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.health-chip {
  min-width: 118px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(21, 245, 186, 0.08);
  border: 1px solid rgba(21, 245, 186, 0.2);
  text-align: center;
}

.health-chip span {
  display: block;
  color: rgba(220, 239, 255, 0.56);
  font-size: 12px;
}

.health-chip strong {
  display: block;
  margin-top: 4px;
  font-size: 30px;
  color: var(--green);
}

.detail-close {
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.18);
  background: rgba(7, 18, 35, 0.74);
  color: rgba(230, 247, 255, 0.88);
  cursor: pointer;
}

.detail-modal__body {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr 1.1fr;
  gap: 16px;
}

.detail-section {
  padding: 16px;
  border-radius: 20px;
  background: rgba(3, 13, 27, 0.44);
  border: 1px solid rgba(61, 225, 255, 0.12);
}

.detail-section__title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.detail-section__title h4 {
  margin: 0;
  font-size: 16px;
}

.detail-section__title span {
  color: rgba(220, 239, 255, 0.54);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-grid article {
  padding: 12px;
  border-radius: 16px;
  background: rgba(7, 18, 35, 0.68);
  border: 1px solid rgba(61, 225, 255, 0.1);
}

.metric-grid__item--emphasis {
  border-color: rgba(21, 245, 186, 0.22);
  box-shadow: inset 0 0 0 1px rgba(21, 245, 186, 0.06);
}

.metric-grid span {
  display: block;
  margin-bottom: 8px;
  color: rgba(220, 239, 255, 0.54);
  font-size: 12px;
}

.metric-grid strong {
  font-size: 18px;
}

.preview-chart {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  height: 100%;
  min-height: 250px;
}

.preview-chart__col {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.preview-chart__bar-wrap {
  width: 100%;
  height: 180px;
  display: flex;
  align-items: end;
}

.preview-chart__bar {
  width: 100%;
  border-radius: 12px 12px 4px 4px;
  background: linear-gradient(180deg, rgba(21, 245, 186, 0.92), rgba(70, 179, 255, 0.4));
  box-shadow: 0 0 18px rgba(61, 225, 255, 0.18);
}

.preview-chart__col strong {
  font-size: 14px;
}

.preview-chart__col span {
  color: rgba(220, 239, 255, 0.54);
  font-size: 11px;
}

.strategy-card {
  display: grid;
  gap: 12px;
}

.strategy-card > p {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.strategy-card__alerts {
  display: grid;
  gap: 10px;
}

.strategy-alert {
  padding: 12px;
  border-radius: 16px;
  background: rgba(7, 18, 35, 0.7);
  border: 1px solid rgba(61, 225, 255, 0.12);
}

.strategy-alert--high {
  border-color: rgba(255, 111, 145, 0.28);
}

.strategy-alert--medium {
  border-color: rgba(255, 214, 107, 0.24);
}

.strategy-alert--info,
.strategy-alert--stable {
  border-color: rgba(21, 245, 186, 0.2);
}

.strategy-alert strong,
.strategy-alert span {
  display: block;
}

.strategy-alert span {
  margin: 4px 0 6px;
  color: rgba(220, 239, 255, 0.56);
  font-size: 12px;
}

.strategy-alert p {
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.5;
}

.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.2s ease;
}

.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1360px) {
  .detail-modal__body {
    grid-template-columns: 1fr;
  }

  .detail-modal__meta {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 900px) {
  .detail-modal__panel {
    width: min(100vw - 24px, 1180px);
    padding: 18px;
    border-radius: 22px;
  }

  .detail-modal__header {
    flex-direction: column;
  }

  .metric-grid,
  .preview-chart {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .detail-modal__panel {
    width: min(100vw - 16px, 1180px);
    padding: 14px;
  }

  .metric-grid,
  .preview-chart {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
