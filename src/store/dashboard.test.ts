import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDashboardStore } from './dashboard';

afterEach(() => {
  vi.useRealTimers();
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
});
