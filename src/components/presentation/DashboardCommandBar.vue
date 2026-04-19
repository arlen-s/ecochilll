<template>
  <teleport to="body">
    <div class="command-dock">
      <transition name="panel-fade">
        <button v-if="open" class="command-dock__backdrop" aria-label="关闭答辩助手" @click="open = false"></button>
      </transition>

      <div class="command-dock__layer">
        <transition name="panel-pop">
          <section v-if="open" class="command-panel glass-card" @click.stop>
            <header class="command-panel__header">
              <div>
                <div class="story-meta">
                  <span class="metric-chip">
                    {{ store.presentationActive ? (store.presentationPaused ? '答辩脚本已暂停' : '答辩脚本进行中') : '答辩脚本待命' }}
                  </span>
                  <span class="story-step">章节 {{ store.presentationChapters.length ? store.currentChapterIndex + 1 : 0 }} / {{ store.presentationChapters.length }}</span>
                </div>
                <h3>{{ storyTitle }}</h3>
                <p>{{ storySummary }}</p>
              </div>

              <button class="panel-close" @click="open = false">关闭</button>
            </header>

            <div class="story-progress">
              <div class="story-progress__fill" :style="{ width: `${store.presentationProgressPct}%` }"></div>
            </div>

            <div class="panel-actions">
              <button class="action-btn action-btn--primary" @click="store.restartPresentation()">
                {{ store.presentationActive ? '重播答辩' : '启动答辩' }}
              </button>
              <button class="action-btn" :disabled="!store.presentationActive" @click="store.togglePresentation()">
                {{ store.presentationPaused ? '继续' : '暂停' }}
              </button>
              <button class="action-btn" @click="store.nextPresentationChapter()">下一章节</button>
              <button class="action-btn" @click="store.openDetail()">设备详情</button>
              <button class="action-btn" @click="detailMode = !detailMode">
                {{ detailMode ? '精简信息' : '展开信息' }}
              </button>
            </div>

            <div class="panel-summary">
              <div class="summary-card">
                <small>展示亮点</small>
                <strong>{{ storyHighlight }}</strong>
              </div>
              <div class="summary-card">
                <small>答辩收益点</small>
                <strong>{{ storyBenefit }}</strong>
              </div>
              <div class="summary-card">
                <small>数据链路</small>
                <strong>{{ store.runtimeMeta.providerLabel }}</strong>
                <span>{{ providerModeText }}</span>
              </div>
            </div>

            <div v-if="store.loadError" class="error-tip">{{ store.loadError }}</div>

            <div class="panel-alerts">
              <button
                v-for="alert in shownAlerts"
                :key="alert.id"
                :class="['alert-card', `alert-card--${alert.level}`]"
                @click="store.focusAlert(alert)"
              >
                <div class="alert-card__head">
                  <span>{{ alertLevelLabel[alert.level] }}</span>
                  <strong>{{ alert.title }}</strong>
                </div>
                <p v-if="detailMode">{{ alert.summary }}</p>
                <footer>
                  <span>{{ alert.metric }}: {{ alert.value }}</span>
                  <span v-if="detailMode">{{ alert.suggestion }}</span>
                </footer>
              </button>
            </div>
          </section>
        </transition>

        <button
          :class="['command-trigger', { 'command-trigger--active': open }]"
          :aria-expanded="open"
          aria-label="打开答辩助手"
          @click="open = !open"
        >
          <span class="command-trigger__icon">AI</span>
          <span class="command-trigger__body">
            <strong>答辩助手</strong>
            <small>{{ triggerText }}</small>
          </span>
          <span v-if="store.activeAlerts.length" class="command-trigger__badge">{{ store.activeAlerts.length }}</span>
        </button>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useDashboardStore } from '@/store/dashboard';

const store = useDashboardStore();
const open = ref(false);
const detailMode = ref(false);

const alertLevelLabel = {
  high: '高优先级',
  medium: '策略关注',
  info: '运行提示',
} as const;

const providerModeText = computed(() => (store.runtimeMeta.dataSource === 'api' ? '实时接口模式' : 'Mock 演示模式'));
const storyTitle = computed(() => store.currentChapter?.title ?? '答辩模式已就绪');
const storySummary = computed(
  () =>
    store.currentChapter?.summary ??
    '点击启动答辩后，系统会自动切换场景、时间、视角与关键设备，方便你现场串讲。',
);
const storyHighlight = computed(
  () => store.currentChapter?.highlight ?? '自动串联技术深度、商业价值和双碳目标表达。',
);
const storyBenefit = computed(() => store.currentChapter?.benefit ?? '默认收纳为悬浮按钮，不再占用主预览区域。');
const shownAlerts = computed(() => (detailMode.value ? store.activeAlerts : store.activeAlerts.slice(0, 3)));
const triggerText = computed(() => {
  if (store.presentationActive && !store.presentationPaused) return '点击收起 / 查看控制';
  if (store.presentationPaused) return '脚本暂停中';
  return '点击展开操作浮窗';
});

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    open.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.command-dock {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 55;
}

.command-dock__backdrop {
  position: fixed;
  inset: 0;
  border: 0;
  background: transparent;
  cursor: default;
}

.command-dock__layer {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.command-panel {
  width: min(420px, calc(100vw - 32px));
  max-height: min(72vh, 760px);
  padding: 16px;
  border-radius: 24px;
  overflow: auto;
}

.command-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.story-meta,
.panel-actions,
.panel-summary {
  display: flex;
  gap: 10px;
}

.story-meta {
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.story-step {
  color: rgba(220, 239, 255, 0.58);
  font-size: 12px;
  letter-spacing: 0.1em;
}

.command-panel__header h3 {
  margin: 0 0 6px;
  font-size: 20px;
}

.command-panel__header p {
  margin: 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.5;
}

.panel-close {
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  background: rgba(7, 18, 35, 0.74);
  color: rgba(230, 247, 255, 0.88);
  cursor: pointer;
}

.story-progress {
  margin-top: 12px;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(61, 225, 255, 0.08);
}

.story-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #15f5ba, #46b3ff);
  box-shadow: 0 0 18px rgba(21, 245, 186, 0.28);
  transition: width 0.35s ease;
}

.panel-actions {
  margin-top: 12px;
  flex-wrap: wrap;
}

.action-btn {
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.16);
  background: rgba(7, 18, 35, 0.74);
  color: rgba(230, 247, 255, 0.88);
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn--primary {
  border-color: rgba(21, 245, 186, 0.34);
  background: linear-gradient(135deg, rgba(21, 245, 186, 0.16), rgba(70, 179, 255, 0.12));
}

.panel-summary {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(3, 13, 27, 0.42);
  border: 1px solid rgba(61, 225, 255, 0.12);
}

.summary-card small,
.summary-card span {
  display: block;
  color: rgba(220, 239, 255, 0.54);
  font-size: 11px;
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.45;
}

.error-tip {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 111, 145, 0.08);
  border: 1px solid rgba(255, 111, 145, 0.18);
  color: #ffdce5;
  font-size: 12px;
}

.panel-alerts {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.alert-card {
  padding: 12px;
  border-radius: 16px;
  text-align: left;
  background: rgba(5, 15, 28, 0.58);
  border: 1px solid rgba(61, 225, 255, 0.12);
  color: inherit;
  cursor: pointer;
}

.alert-card--high {
  border-color: rgba(255, 111, 145, 0.3);
}

.alert-card--medium {
  border-color: rgba(255, 214, 107, 0.24);
}

.alert-card--info {
  border-color: rgba(61, 225, 255, 0.18);
}

.alert-card__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.alert-card__head span {
  color: rgba(220, 239, 255, 0.56);
  font-size: 11px;
}

.alert-card__head strong {
  font-size: 14px;
}

.alert-card p {
  margin: 8px 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.45;
}

.alert-card footer {
  display: grid;
  gap: 4px;
  color: rgba(220, 239, 255, 0.58);
  font-size: 11px;
}

.command-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 168px;
  padding: 12px 14px 12px 12px;
  border-radius: 999px;
  border: 1px solid rgba(61, 225, 255, 0.18);
  background:
    linear-gradient(135deg, rgba(7, 18, 35, 0.94), rgba(11, 30, 48, 0.88)),
    radial-gradient(circle at top left, rgba(21, 245, 186, 0.12), transparent 42%);
  color: rgba(230, 247, 255, 0.92);
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
}

.command-trigger--active {
  border-color: rgba(21, 245, 186, 0.38);
}

.command-trigger__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(21, 245, 186, 0.28), rgba(70, 179, 255, 0.22));
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}

.command-trigger__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.command-trigger__body strong {
  font-size: 14px;
}

.command-trigger__body small {
  color: rgba(220, 239, 255, 0.6);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-trigger__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #ff6f91;
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.panel-fade-enter-active,
.panel-fade-leave-active,
.panel-pop-enter-active,
.panel-pop-leave-active {
  transition: all 0.18s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
}

.panel-pop-enter-from,
.panel-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@media (max-width: 900px) {
  .command-dock {
    right: 12px;
    bottom: 12px;
  }

  .command-panel {
    width: min(360px, calc(100vw - 24px));
  }

  .panel-summary {
    grid-template-columns: 1fr;
  }
}
</style>
