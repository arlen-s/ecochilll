import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  buildPresentationScript,
  buildRuntimeMeta,
  buildScenarioData,
  buildSystemAlerts,
  deriveLiveSnapshot,
} from '@/mock/energyMock';
import { dashboardService, resolveDashboardDataSource } from '@/services/dashboardService';
import type {
  DashboardRuntimeMeta,
  FocusView,
  NodeDetailData,
  NodeDetailMetric,
  PresentationChapter,
  ScenarioMode,
  SystemAlert,
  SystemNodeStatus,
} from '@/types/energy';

const focusOrder: FocusView[] = ['overview', 'pv', 'ac', 'storage'];
const zoneByNodeId = {
  'building-a': 0,
  'building-b': 1,
  'building-c': 2,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useDashboardStore = defineStore('dashboard', () => {
  const scenario = ref<ScenarioMode>('normal');
  const focus = ref<FocusView>('overview');
  const liveHourIndex = ref(14);
  const currentTime = ref(new Date());
  const selectedNodeId = ref('pv');
  const scenarioData = ref(buildScenarioData(scenario.value));
  const runtimeMeta = ref<DashboardRuntimeMeta>(buildRuntimeMeta(resolveDashboardDataSource()));
  const presentationChapters = ref<PresentationChapter[]>(buildPresentationScript());
  const currentChapterIndex = ref(0);
  const detailVisible = ref(false);
  const loading = ref(false);
  const loadError = ref('');
  const presentationActive = ref(false);
  const presentationPaused = ref(false);
  const presentationProgressPct = ref(0);

  let clockTimer: number | undefined;
  let autoplayTimer: number | undefined;
  let focusTimer: number | undefined;
  let presentationTimer: number | undefined;
  let chapterStartedAt = 0;
  let chapterRemainingMs = 0;
  let chapterTotalMs = 0;

  const liveSnapshot = computed(() => deriveLiveSnapshot(scenarioData.value, liveHourIndex.value));
  const selectedNode = computed<SystemNodeStatus>(
    () => scenarioData.value.nodes.find((item) => item.id === selectedNodeId.value) ?? scenarioData.value.nodes[0]!,
  );
  const activeAlerts = computed<SystemAlert[]>(() =>
    buildSystemAlerts(scenarioData.value, liveSnapshot.value, liveHourIndex.value),
  );
  const currentChapter = computed<PresentationChapter | null>(
    () => presentationChapters.value[currentChapterIndex.value] ?? null,
  );

  const buildPreviewSeries = (node: SystemNodeStatus) => {
    const start = Math.max(0, liveHourIndex.value - 2);
    return scenarioData.value.hourly.slice(start, start + 6).map((item) => {
      let value = item.gridImportKw;

      if (node.type === 'pv') value = item.photovoltaicKw;
      if (node.type === 'ac') value = item.loadKw;
      if (node.type === 'storage') value = Math.max(item.storageChargeKw, item.storageDischargeKw);
      if (node.type === 'grid') value = item.gridImportKw;

      if (node.id in zoneByNodeId) {
        const ratio = [0.34, 0.27, 0.22][zoneByNodeId[node.id as keyof typeof zoneByNodeId]];
        value = Math.round(item.loadKw * ratio);
      }

      return {
        hour: item.hour,
        value,
      };
    });
  };

  const buildNodeMetrics = (node: SystemNodeStatus): NodeDetailMetric[] => {
    const live = liveSnapshot.value;

    if (node.type === 'pv') {
      return [
        { label: '实时功率', value: `${live.photovoltaic.powerKw} kW`, emphasis: true },
        { label: '累计发电', value: `${live.photovoltaic.todayGenerationKwh} kWh` },
        { label: '辐照强度', value: `${live.photovoltaic.irradianceWm2} W/m²` },
        { label: '发电效率', value: `${live.photovoltaic.efficiencyPct.toFixed(1)}%` },
        { label: '面板温度', value: `${live.photovoltaic.panelTempC.toFixed(1)}℃` },
        { label: '波动系数', value: `${live.photovoltaic.fluctuationPct.toFixed(1)}%` },
      ];
    }

    if (node.id in zoneByNodeId) {
      const zone = live.airConditioning.zones[zoneByNodeId[node.id as keyof typeof zoneByNodeId]];
      return [
        { label: '区域负荷', value: `${zone.loadKw} kW`, emphasis: true },
        { label: '室内温度', value: `${zone.indoorTempC.toFixed(1)}℃` },
        { label: '目标温度', value: `${zone.targetTempC.toFixed(1)}℃` },
        { label: '舒适度', value: `${zone.comfortPct.toFixed(0)}%` },
        { label: '湿度', value: `${zone.humidityPct.toFixed(0)}%` },
        { label: '占用率', value: `${zone.occupancyPct.toFixed(0)}%` },
      ];
    }

    if (node.type === 'ac') {
      return [
        { label: '总负荷', value: `${live.airConditioning.totalLoadKw} kW`, emphasis: true },
        { label: '运行状态', value: live.airConditioning.runningStatus },
        { label: '室外温度', value: `${live.airConditioning.outdoorTempC.toFixed(1)}℃` },
        { label: '平均室温', value: `${live.airConditioning.indoorAvgTempC.toFixed(1)}℃` },
        { label: '湿度', value: `${live.airConditioning.humidityPct.toFixed(0)}%` },
        { label: '舒适度', value: `${live.airConditioning.comfortPct.toFixed(0)}%` },
      ];
    }

    if (node.type === 'storage') {
      return [
        { label: 'SOC', value: `${live.storage.socPct.toFixed(1)}%`, emphasis: true },
        { label: '容量', value: `${live.storage.capacityKwh} kWh` },
        { label: '充电功率', value: `${live.storage.chargePowerKw} kW` },
        { label: '放电功率', value: `${live.storage.dischargePowerKw} kW` },
        { label: '健康度', value: `${live.storage.healthPct.toFixed(1)}%` },
        { label: '循环次数', value: `${live.storage.cycleCount}` },
      ];
    }

    if (node.type === 'grid') {
      return [
        { label: '网购电功率', value: `${live.gridImportKw} kW`, emphasis: true },
        { label: '峰谷收益', value: `¥${live.economics.peakValleyBenefitCny}` },
        { label: '当日收益', value: `¥${live.economics.dailySavingCny}` },
        { label: '绿电占比', value: `${live.coreKpi.greenEnergyRatioPct.toFixed(1)}%` },
        { label: '调度时刻', value: live.hourLabel },
        { label: '场景模式', value: scenarioData.value.scenarioLabel },
      ];
    }

    return [
      { label: '当前功率', value: `${node.powerKw} kW`, emphasis: true },
      { label: '运行状态', value: node.state },
      { label: '效率评分', value: `${node.efficiencyPct.toFixed(0)}%` },
    ];
  };

  const buildNodeRecommendation = (node: SystemNodeStatus) => {
    const alert = activeAlerts.value.find((item) => item.nodeId === node.id);
    if (alert) return alert.suggestion;

    if (node.type === 'pv') return '保持高光照窗口下的直供优先策略，并同步补能储电。';
    if (node.type === 'ac') return '根据人流与温度变化动态调整分区送风，兼顾舒适与削峰。';
    if (node.type === 'storage') return '围绕峰谷电价维持健康 SOC 区间，增强晚峰段放电价值。';
    if (node.type === 'grid') return '将电网侧功率维持在可控区间，避免峰段形成新的需量峰值。';
    return '维持当前协同策略，重点观察负荷变化与舒适度反馈。';
  };

  const selectedNodeDetail = computed<NodeDetailData>(() => {
    const node = selectedNode.value;
    const relatedAlerts = activeAlerts.value.filter(
      (item) => item.nodeId === node.id || (node.id in zoneByNodeId && item.nodeId === 'ac'),
    );
    const healthPenalty = relatedAlerts.reduce((sum, item) => sum + (item.level === 'high' ? 10 : item.level === 'medium' ? 6 : 2), 0);

    return {
      nodeId: node.id,
      title: node.label,
      subtitle: `${scenarioData.value.scenarioLabel} / ${liveSnapshot.value.hourLabel} / ${node.state}`,
      healthScore: clamp(Math.round(node.efficiencyPct + 6 - healthPenalty), 62, 99),
      recommendation: buildNodeRecommendation(node),
      strategyLink: scenarioData.value.ai.title,
      metrics: buildNodeMetrics(node),
      preview: buildPreviewSeries(node),
      relatedAlerts,
    };
  });

  const refreshPresentationProgress = () => {
    if (!presentationActive.value || presentationPaused.value || !currentChapter.value || chapterStartedAt === 0) {
      return;
    }

    const elapsed = Date.now() - chapterStartedAt;
    const duration = chapterTotalMs || currentChapter.value.durationMs;
    presentationProgressPct.value = clamp((elapsed / duration) * 100, 0, 100);
  };

  const clearPresentationTimer = () => {
    if (presentationTimer) {
      window.clearTimeout(presentationTimer);
      presentationTimer = undefined;
    }
  };

  const scheduleCurrentChapter = (durationMs: number, totalMs = durationMs) => {
    clearPresentationTimer();
    chapterStartedAt = Date.now();
    chapterRemainingMs = durationMs;
    chapterTotalMs = totalMs;
    if (durationMs === totalMs) {
      presentationProgressPct.value = 0;
    }
    presentationTimer = window.setTimeout(() => {
      void nextPresentationChapter();
    }, durationMs);
  };

  const refreshScenarioData = async (mode = scenario.value) => {
    loading.value = true;
    loadError.value = '';

    try {
      const data = await dashboardService.getScenarioData(mode);
      scenarioData.value = data;
      runtimeMeta.value = {
        ...runtimeMeta.value,
        lastUpdated: new Date().toISOString(),
      };
      if (!data.nodes.some((item) => item.id === selectedNodeId.value)) {
        selectedNodeId.value = data.nodes[0]?.id ?? 'pv';
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '数据源加载失败，已切回本地模拟数据。';
      scenarioData.value = buildScenarioData(mode);
      runtimeMeta.value = {
        ...buildRuntimeMeta(resolveDashboardDataSource()),
        providerLabel: 'Mock Twin Engine / Fallback',
      };
    } finally {
      loading.value = false;
    }
  };

  const initialize = async () => {
    loading.value = true;

    try {
      const [meta, chapters] = await Promise.all([
        dashboardService.getRuntimeMeta(),
        dashboardService.getPresentationChapters(),
      ]);
      runtimeMeta.value = meta;
      presentationChapters.value = chapters;
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '初始化失败，已使用本地默认配置。';
      runtimeMeta.value = buildRuntimeMeta(resolveDashboardDataSource());
      presentationChapters.value = buildPresentationScript();
    } finally {
      loading.value = false;
    }

    await refreshScenarioData(scenario.value);
  };

  const setScenario = async (mode: ScenarioMode) => {
    scenario.value = mode;
    await refreshScenarioData(mode);
  };

  const setFocus = (nextFocus: FocusView) => {
    focus.value = nextFocus;
  };

  const selectNode = (id: string, options: { openDetail?: boolean } = {}) => {
    selectedNodeId.value = id;
    if (id === 'pv') focus.value = 'pv';
    if (id === 'ac') focus.value = 'ac';
    if (id === 'storage') focus.value = 'storage';
    if (id === 'grid' || id.startsWith('building')) focus.value = 'overview';
    if (options.openDetail) detailVisible.value = true;
  };

  const openDetail = (id?: string) => {
    if (presentationActive.value && !presentationPaused.value) {
      pausePresentation();
    }
    if (id) {
      selectNode(id);
    }
    detailVisible.value = true;
  };

  const closeDetail = () => {
    detailVisible.value = false;
  };

  const goToChapter = async (index: number) => {
    const chapter = presentationChapters.value[index];

    if (!chapter) {
      presentationActive.value = false;
      presentationPaused.value = false;
      presentationProgressPct.value = 0;
      chapterStartedAt = 0;
      chapterRemainingMs = 0;
      chapterTotalMs = 0;
      clearPresentationTimer();
      return;
    }

    currentChapterIndex.value = index;
    presentationActive.value = true;
    presentationPaused.value = false;

    if (scenario.value !== chapter.scenario) {
      await setScenario(chapter.scenario);
    }

    liveHourIndex.value = chapter.hourIndex;
    setFocus(chapter.focus);
    selectNode(chapter.nodeId);
    scheduleCurrentChapter(chapter.durationMs, chapter.durationMs);
  };

  const startPresentation = async () => {
    await goToChapter(0);
  };

  const restartPresentation = async () => {
    await goToChapter(0);
  };

  const nextPresentationChapter = async () => {
    const nextIndex = presentationActive.value ? currentChapterIndex.value + 1 : currentChapterIndex.value;
    if (nextIndex >= presentationChapters.value.length) {
      presentationActive.value = false;
      presentationPaused.value = false;
      presentationProgressPct.value = 100;
      chapterStartedAt = 0;
      chapterRemainingMs = 0;
      chapterTotalMs = 0;
      clearPresentationTimer();
      return;
    }

    await goToChapter(nextIndex);
  };

  const pausePresentation = () => {
    if (!presentationActive.value || presentationPaused.value || !currentChapter.value) return;

    presentationPaused.value = true;
    chapterRemainingMs = Math.max(0, currentChapter.value.durationMs - (Date.now() - chapterStartedAt));
    clearPresentationTimer();
    refreshPresentationProgress();
  };

  const resumePresentation = () => {
    if (!presentationActive.value || !presentationPaused.value) return;
    presentationPaused.value = false;
    scheduleCurrentChapter(chapterRemainingMs || currentChapter.value?.durationMs || 4000, chapterTotalMs || currentChapter.value?.durationMs || 4000);
  };

  const togglePresentation = async () => {
    if (!presentationActive.value) {
      await startPresentation();
      return;
    }

    if (presentationPaused.value) {
      resumePresentation();
      return;
    }

    pausePresentation();
  };

  const focusAlert = (alert: SystemAlert) => {
    selectNode(alert.nodeId, { openDetail: true });
  };

  const start = () => {
    stop();
    clockTimer = window.setInterval(() => {
      currentTime.value = new Date();
      refreshPresentationProgress();
    }, 500);
    autoplayTimer = window.setInterval(() => {
      if (!presentationActive.value && !detailVisible.value) {
        liveHourIndex.value = (liveHourIndex.value + 1) % 24;
      }
    }, 5000);
    focusTimer = window.setInterval(() => {
      if (!presentationActive.value && !detailVisible.value) {
        const nextIndex = (focusOrder.indexOf(focus.value) + 1) % focusOrder.length;
        focus.value = focusOrder[nextIndex];
      }
    }, 9000);
  };

  const stop = () => {
    if (clockTimer) window.clearInterval(clockTimer);
    if (autoplayTimer) window.clearInterval(autoplayTimer);
    if (focusTimer) window.clearInterval(focusTimer);
    chapterStartedAt = 0;
    chapterRemainingMs = 0;
    chapterTotalMs = 0;
    clearPresentationTimer();
  };

  return {
    scenario,
    focus,
    liveHourIndex,
    currentTime,
    scenarioData,
    liveSnapshot,
    selectedNodeId,
    selectedNode,
    selectedNodeDetail,
    detailVisible,
    runtimeMeta,
    loading,
    loadError,
    activeAlerts,
    presentationActive,
    presentationPaused,
    presentationProgressPct,
    presentationChapters,
    currentChapterIndex,
    currentChapter,
    initialize,
    setScenario,
    setFocus,
    selectNode,
    openDetail,
    closeDetail,
    startPresentation,
    restartPresentation,
    nextPresentationChapter,
    pausePresentation,
    resumePresentation,
    togglePresentation,
    focusAlert,
    start,
    stop,
  };
});
