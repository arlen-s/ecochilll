import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildScenarioData } from '@/mock/energyMock';
import { dashboardService } from '@/services/dashboardService';
import type { DashboardScenarioData } from '@/types/energy';
import { useDashboardStore } from './dashboard';

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dashboard operation mode', () => {
  it('switches to heating with synchronized thermal-storage detail data', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    setActivePinia(createPinia());
    const store = useDashboardStore();

    expect(store.setOperationMode).toBeTypeOf('function');

    const switching = store.setOperationMode('heating');
    await vi.runAllTimersAsync();
    await switching;
    store.selectNode('storage');

    expect(store.operationMode).toBe('heating');
    expect(store.scenarioData.operationMode).toBe('heating');
    expect(store.scenarioData.storage.operationMode).toBe('heating');

    store.liveHourIndex = 9;
    store.selectNode('pv');
    expect(store.selectedNodeDetail.recommendation).toContain('补充蓄热量');
    expect(store.selectedNodeDetail.recommendation).not.toContain('储电');

    store.liveHourIndex = 14;
    store.selectNode('storage');
    expect(store.selectedNodeDetail.metrics.map((metric) => metric.label)).toEqual([
      '蓄热水位',
      '可用热量',
      '充热功率',
      '放热功率',
      '供水温度',
      '回水温度',
      '可用时长',
      '水罐容积',
    ]);
    expect(store.selectedNodeDetail.metrics.map((metric) => metric.value)).toEqual([
      `${store.liveSnapshot.storage.storageLevelPct.toFixed(1)}%`,
      `${store.liveSnapshot.storage.storedEnergyKwhTh.toFixed(1)} kWhth`,
      `${store.liveSnapshot.storage.chargePowerKwTh.toFixed(1)} kWth`,
      `${store.liveSnapshot.storage.dischargePowerKwTh.toFixed(1)} kWth`,
      `${store.liveSnapshot.storage.supplyTempC.toFixed(1)}℃`,
      `${store.liveSnapshot.storage.returnTempC.toFixed(1)}℃`,
      `${store.liveSnapshot.storage.availableHours.toFixed(1)} h`,
      `${store.liveSnapshot.storage.tankVolumeM3.toFixed(0)} m³`,
    ]);
    expect(store.selectedNodeDetail.metrics[0]?.emphasis).toBe(true);
    expect(store.selectedNodeDetail.preview.map((point) => point.value)).toEqual(
      store.scenarioData.hourly.slice(12, 18).map((point) => point.storageLevelPct),
    );

    const expectedState = {
      charging: '充热中',
      discharging: '放热中',
      standby: '保温待机',
    }[store.liveSnapshot.storage.state];
    expect(store.selectedNodeDetail.subtitle).toContain(expectedState);
    expect(store.selectedNodeDetail.recommendation).toContain('峰前');
    expect(store.selectedNodeDetail.recommendation).toContain('热量');
    expect(store.selectedNodeDetail.recommendation).toContain('最低储备');
  });

  it('keeps the newest operation mode when requests resolve in reverse order', async () => {
    const olderRequest = deferred<DashboardScenarioData>();
    const newerRequest = deferred<DashboardScenarioData>();
    vi.spyOn(dashboardService, 'getScenarioData')
      .mockImplementationOnce(() => olderRequest.promise)
      .mockImplementationOnce(() => newerRequest.promise);
    setActivePinia(createPinia());
    const store = useDashboardStore();

    const olderSwitch = store.setOperationMode('cooling');
    const newerSwitch = store.setOperationMode('heating');

    newerRequest.resolve(buildScenarioData('normal', 'heating'));
    await newerSwitch;
    olderRequest.resolve(buildScenarioData('normal', 'cooling'));
    await olderSwitch;

    expect(store.operationMode).toBe('heating');
    expect(store.scenarioData.operationMode).toBe('heating');
    expect(store.scenarioData.storage.operationMode).toBe('heating');
    expect(store.loading).toBe(false);
  });

  it('ignores a stale rejection after a newer request succeeds', async () => {
    const olderRequest = deferred<DashboardScenarioData>();
    const newerRequest = deferred<DashboardScenarioData>();
    vi.spyOn(dashboardService, 'getScenarioData')
      .mockImplementationOnce(() => olderRequest.promise)
      .mockImplementationOnce(() => newerRequest.promise);
    setActivePinia(createPinia());
    const store = useDashboardStore();

    const olderSwitch = store.setOperationMode('cooling');
    const newerSwitch = store.setOperationMode('heating');

    newerRequest.resolve(buildScenarioData('normal', 'heating'));
    await newerSwitch;
    olderRequest.reject(new Error('stale request failed'));
    await olderSwitch;

    expect(store.operationMode).toBe('heating');
    expect(store.scenarioData.operationMode).toBe('heating');
    expect(store.loadError).toBe('');
    expect(store.runtimeMeta.providerLabel).not.toContain('Fallback');
    expect(store.loading).toBe(false);
  });

  it('keeps the newest presentation chapter when transitions resolve in reverse order', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const olderRequest = deferred<DashboardScenarioData>();
    const newerRequest = deferred<DashboardScenarioData>();
    vi.spyOn(dashboardService, 'getScenarioData')
      .mockImplementationOnce(() => olderRequest.promise)
      .mockImplementationOnce(() => newerRequest.promise);
    setActivePinia(createPinia());
    const store = useDashboardStore();

    store.presentationActive = true;
    store.currentChapterIndex = 4;
    const olderTransition = store.nextPresentationChapter();
    store.currentChapterIndex = 2;
    const newerTransition = store.nextPresentationChapter();

    newerRequest.resolve(buildScenarioData('cloudy', 'cooling'));
    await newerTransition;
    olderRequest.resolve(buildScenarioData('heatwave', 'heating'));
    await olderTransition;

    expect(store.currentChapterIndex).toBe(3);
    expect(store.currentChapter?.id).toBe('chapter-04');
    expect(store.scenario).toBe('cloudy');
    expect(store.operationMode).toBe('cooling');
    expect(store.scenarioData.scenario).toBe('cloudy');
    expect(store.scenarioData.operationMode).toBe('cooling');
    expect(store.liveHourIndex).toBe(14);
    expect(store.focus).toBe('storage');
    expect(store.selectedNodeId).toBe('storage');
    expect(store.presentationActive).toBe(true);
    expect(store.presentationPaused).toBe(false);
    expect(store.presentationProgressPct).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('combines concurrent selector changes using the latest requested values', async () => {
    const heatingRequest = deferred<DashboardScenarioData>();
    const cloudyRequest = deferred<DashboardScenarioData>();
    const getScenarioData = vi.spyOn(dashboardService, 'getScenarioData')
      .mockImplementationOnce(() => heatingRequest.promise)
      .mockImplementationOnce(() => cloudyRequest.promise);
    setActivePinia(createPinia());
    const store = useDashboardStore();

    const heatingSwitch = store.setOperationMode('heating');
    const cloudySwitch = store.setScenario('cloudy');

    cloudyRequest.resolve(buildScenarioData('cloudy', 'heating'));
    await cloudySwitch;
    heatingRequest.resolve(buildScenarioData('normal', 'heating'));
    await heatingSwitch;

    expect(getScenarioData).toHaveBeenNthCalledWith(1, 'normal', 'heating');
    expect(getScenarioData).toHaveBeenNthCalledWith(2, 'cloudy', 'heating');
    expect(store.scenario).toBe('cloudy');
    expect(store.operationMode).toBe('heating');
    expect(store.scenarioData.scenario).toBe('cloudy');
    expect(store.scenarioData.operationMode).toBe('heating');
  });

  it('keeps chapter one data when restart supersedes a pending transition request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const olderRequest = deferred<DashboardScenarioData>();
    const getScenarioData = vi.spyOn(dashboardService, 'getScenarioData')
      .mockImplementationOnce(() => olderRequest.promise);
    setActivePinia(createPinia());
    const store = useDashboardStore();

    store.presentationActive = true;
    store.currentChapterIndex = 4;
    const olderTransition = store.nextPresentationChapter();
    await store.restartPresentation();
    const loadingAfterRestart = store.loading;

    olderRequest.resolve(buildScenarioData('heatwave', 'heating'));
    await olderTransition;

    expect(getScenarioData).toHaveBeenCalledTimes(1);
    expect(loadingAfterRestart).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.currentChapterIndex).toBe(0);
    expect(store.currentChapter?.id).toBe('chapter-01');
    expect(store.scenario).toBe('normal');
    expect(store.operationMode).toBe('cooling');
    expect(store.scenarioData.scenario).toBe('normal');
    expect(store.scenarioData.operationMode).toBe('cooling');
    expect(store.liveHourIndex).toBe(10);
    expect(store.focus).toBe('overview');
    expect(store.selectedNodeId).toBe('pv');
    expect(vi.getTimerCount()).toBe(1);
  });
});
