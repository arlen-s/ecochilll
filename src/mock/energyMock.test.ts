import { describe, expect, it } from 'vitest';
import { calculateSensibleHeatCapacity } from '@/domain/thermalStorage';
import type { OperatingMode, ScenarioMode } from '@/types/energy';
import {
  buildHourlySeries,
  buildPresentationScript,
  buildScenarioData,
  buildSystemAlerts,
  deriveLiveSnapshot,
} from './energyMock';

const scenarios: ScenarioMode[] = ['normal', 'heatwave', 'cloudy', 'peakPricing'];
const operationModes: OperatingMode[] = ['cooling', 'heating'];

const expectedConfig: Record<
  OperatingMode,
  { volumeM3: number; supplyTempC: number; returnTempC: number }
> = {
  cooling: { volumeM3: 180, supplyTempC: 6, returnTempC: 13 },
  heating: { volumeM3: 180, supplyTempC: 45, returnTempC: 35 },
};

describe.each(operationModes)('%s water thermal-storage mock', (operationMode) => {
  describe.each(scenarios)('%s scenario', (scenario) => {
    it('keeps electrical and thermal balances exact for every hour', () => {
      const hourly = buildHourlySeries(scenario, operationMode);

      expect(hourly).toHaveLength(24);
      for (const point of hourly) {
        expect(point.photovoltaicKw + point.gridImportKw).toBeCloseTo(
          point.totalElectricLoadKw + point.gridExportKw,
          8,
        );
        expect(point.plantDirectThermalKwTh + point.storageDischargeKwTh).toBeCloseTo(
          point.thermalLoadKwTh,
          8,
        );
      }
    });

    it('never charges and discharges at the same time and keeps storage bounded', () => {
      const hourly = buildHourlySeries(scenario, operationMode);

      for (const point of hourly) {
        expect(point.storageChargeKwTh > 0 && point.storageDischargeKwTh > 0).toBe(false);
        expect(point.storageLevelPct).toBeGreaterThanOrEqual(0);
        expect(point.storageLevelPct).toBeLessThanOrEqual(100);
      }
    });

    it('does not count thermal discharge as electrical generation', () => {
      const hourly = buildHourlySeries(scenario, operationMode);

      for (const point of hourly) {
        expect(point.totalElectricLoadKw).toBeCloseTo(
          point.baseElectricLoadKw + point.plantElectricPowerKw + point.pumpElectricPowerKw,
          8,
        );
      }
    });

    it('returns finite non-negative power, energy, price, carbon, and saving values', () => {
      const hourly = buildHourlySeries(scenario, operationMode);

      for (const point of hourly) {
        const values = [
          point.photovoltaicKw,
          point.baseElectricLoadKw,
          point.plantElectricPowerKw,
          point.pumpElectricPowerKw,
          point.totalElectricLoadKw,
          point.gridImportKw,
          point.gridExportKw,
          point.thermalLoadKwTh,
          point.plantDirectThermalKwTh,
          point.storageChargeKwTh,
          point.storageDischargeKwTh,
          point.storedEnergyKwhTh,
          point.storageLevelPct,
          point.carbonReductionKg,
          point.savingCny,
          point.priceCny,
          point.irradianceWm2,
        ];

        for (const value of values) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('uses the configured water tank capacity and mode temperatures', () => {
      const data = buildScenarioData(scenario, operationMode);
      const config = expectedConfig[operationMode];
      const expectedCapacity = calculateSensibleHeatCapacity(
        config.volumeM3,
        Math.abs(config.returnTempC - config.supplyTempC),
      );

      expect(data.operationMode).toBe(operationMode);
      expect(data.storage.operationMode).toBe(operationMode);
      expect(data.storage.capacityKwhTh).toBeCloseTo(expectedCapacity, 8);
      expect(data.storage.tankVolumeM3).toBe(config.volumeM3);
      expect(data.storage.supplyTempC).toBe(config.supplyTempC);
      expect(data.storage.returnTempC).toBe(config.returnTempC);
      expect(data.storage.storedEnergyKwhTh).toBeCloseTo(data.hourly[14].storedEnergyKwhTh, 8);

      if (operationMode === 'cooling') {
        expect(data.storage.supplyTempC).toBeLessThan(data.storage.returnTempC);
      } else {
        expect(data.storage.supplyTempC).toBeGreaterThan(data.storage.returnTempC);
      }
    });

    it('keeps live data and system outputs aligned with the selected mode', () => {
      const data = buildScenarioData(scenario, operationMode);
      const live = deriveLiveSnapshot(data, 14);
      const alerts = buildSystemAlerts(data, live, 14);
      const storageNode = data.nodes.find((node) => node.id === 'storage');

      expect(live.operationMode).toBe(operationMode);
      expect(live.storage.storageLevelPct).toBeCloseTo(data.hourly[14].storageLevelPct, 8);
      expect(storageNode).toMatchObject({ label: '分层蓄能水罐', powerUnit: 'kWth' });
      expect(storageNode?.detail).toMatch(/水罐/);
      expect(storageNode?.detail).toMatch(/水泵/);
      expect(storageNode?.detail).toMatch(/换热/);
      expect(alerts.every((alert) => !/SOC|PCS|BMS|电池/.test(JSON.stringify(alert)))).toBe(true);
      expect(data.energyMix.every((item) => !/储能|冷量|热量/.test(item.name))).toBe(true);
    });
  });

  it('uses only valley-grid or surplus-PV windows for charging', () => {
    for (const scenario of scenarios) {
      for (const point of buildHourlySeries(scenario, operationMode)) {
        const hour = Number.parseInt(point.hour.slice(0, 2), 10);
        if (point.storageChargeKwTh > 0 && hour > 6) {
          expect(point.gridImportKw).toBeCloseTo(0, 8);
          expect(point.photovoltaicKw).toBeGreaterThanOrEqual(point.totalElectricLoadKw);
        }
      }
    }
  });
});

describe('mode-aware scenario and presentation output', () => {
  it('models heatwave as hot weather for cooling and a cold wave for heating', () => {
    const coolingNormal = buildScenarioData('normal', 'cooling');
    const coolingStress = buildScenarioData('heatwave', 'cooling');
    const heatingNormal = buildScenarioData('normal', 'heating');
    const heatingStress = buildScenarioData('heatwave', 'heating');

    expect(coolingStress.scenarioLabel).toContain('高温');
    expect(coolingStress.hourly[14].ambientTempC).toBeGreaterThan(coolingNormal.hourly[14].ambientTempC);
    expect(heatingStress.scenarioLabel).toContain('寒潮');
    expect(heatingStress.hourly[14].ambientTempC).toBeLessThan(heatingNormal.hourly[14].ambientTempC);
    expect(heatingStress.hourly[14].ambientTempC).toBeLessThan(15);
  });

  it('preserves six valid chapters with deterministic operating modes', () => {
    const chapters = buildPresentationScript();

    expect(chapters).toHaveLength(6);
    expect(chapters.some((chapter) => chapter.operationMode === 'heating')).toBe(true);
    for (const chapter of chapters) {
      expect(operationModes).toContain(chapter.operationMode);
      expect(scenarios).toContain(chapter.scenario);
      expect(['overview', 'pv', 'ac', 'storage']).toContain(chapter.focus);
      const data = buildScenarioData(chapter.scenario, chapter.operationMode);
      expect(data.nodes.some((node) => node.id === chapter.nodeId)).toBe(true);
      expect(chapter.hourIndex).toBeGreaterThanOrEqual(0);
      expect(chapter.hourIndex).toBeLessThan(data.hourly.length);
    }
  });
});
