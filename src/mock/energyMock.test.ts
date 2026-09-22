import { describe, expect, it } from 'vitest';
import { calculateSensibleHeatCapacity, stepThermalStorage } from '@/domain/thermalStorage';
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
  {
    volumeM3: number;
    supplyTempC: number;
    returnTempC: number;
    plantCop: number;
    maxDischargePowerKwTh: number;
  }
> = {
  cooling: {
    volumeM3: 180,
    supplyTempC: 6,
    returnTempC: 13,
    plantCop: 5.2,
    maxDischargePowerKwTh: 220,
  },
  heating: {
    volumeM3: 180,
    supplyTempC: 45,
    returnTempC: 35,
    plantCop: 3.4,
    maxDischargePowerKwTh: 240,
  },
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

    it('returns finite non-negative power, energy, price, and carbon values', () => {
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
          point.priceCny,
          point.irradianceWm2,
        ];

        for (const value of values) {
          expect(Number.isFinite(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('converts plant thermal production to electricity using the exact mode COP', () => {
      const hourly = buildHourlySeries(scenario, operationMode);
      const { plantCop } = expectedConfig[operationMode];

      for (const point of hourly) {
        expect(point.plantElectricPowerKw).toBeCloseTo(
          (point.plantDirectThermalKwTh + point.storageChargeKwTh) / plantCop,
          10,
        );
      }
    });

    it('carries stored thermal energy through the exact hourly loss and efficiency recurrence', () => {
      const hourly = buildHourlySeries(scenario, operationMode);
      const data = buildScenarioData(scenario, operationMode);
      let previousStoredEnergyKwhTh = data.storage.capacityKwhTh * 0.32;

      for (const point of hourly) {
        const expectedStep = stepThermalStorage({
          capacityKwhTh: data.storage.capacityKwhTh,
          storedEnergyKwhTh: previousStoredEnergyKwhTh,
          durationHours: 1,
          chargePowerKwTh: point.storageChargeKwTh,
          dischargePowerKwTh: point.storageDischargeKwTh,
          chargeEfficiency: 0.94,
          dischargeEfficiency: 0.92,
          standingLossPctPerHour: 0.001,
        });

        expect(point.storedEnergyKwhTh).toBeCloseTo(expectedStep.storedEnergyKwhTh, 9);
        previousStoredEnergyKwhTh = point.storedEnergyKwhTh;
      }
    });

    it('prices overall savings against a no-PV, no-storage grid bill', () => {
      const data = buildScenarioData(scenario, operationMode);
      const { plantCop } = expectedConfig[operationMode];
      const expectedHourlySavings = data.hourly.map((point) => {
        const baselineGridCostCny = (
          point.baseElectricLoadKw + point.thermalLoadKwTh / plantCop + 2
        ) * point.priceCny;
        const actualGridCostCny = point.gridImportKw * point.priceCny;
        return baselineGridCostCny - actualGridCostCny;
      });
      const expectedDailySavingCny = expectedHourlySavings.reduce((sum, value) => sum + value, 0);

      data.hourly.forEach((point, index) => {
        expect(point.savingCny).toBeCloseTo(expectedHourlySavings[index], 9);
      });
      expect(data.economics.dailySavingCny).toBeCloseTo(expectedDailySavingCny, 9);
    });

    it('prices storage benefit against the same-PV no-storage grid bill', () => {
      const data = buildScenarioData(scenario, operationMode);
      const { plantCop } = expectedConfig[operationMode];
      const expectedHourlyStorageBenefitCny = data.hourly.map((point) => {
        const noStorageTotalLoadKw =
          point.baseElectricLoadKw + point.thermalLoadKwTh / plantCop + 2;
        const noStorageGridImportKw = Math.max(0, noStorageTotalLoadKw - point.photovoltaicKw);
        return (
          noStorageGridImportKw * point.priceCny - point.gridImportKw * point.priceCny
        );
      });
      const expectedStorageBenefitCny = expectedHourlyStorageBenefitCny.reduce(
        (sum, benefit) => sum + benefit,
        0,
      );

      data.hourly.forEach((point, index) => {
        expect(point.storageBenefitCny).toBeCloseTo(expectedHourlyStorageBenefitCny[index], 9);
      });
      expect(data.economics.peakValleyBenefitCny).toBeCloseTo(expectedStorageBenefitCny, 9);
      expect(data.ai.expectedBenefitCny).toBe(Math.round(expectedStorageBenefitCny));
      expect(data.ai.strategyRules.map((rule) => rule.expectedBenefitCny)).toEqual([
        Math.round(expectedStorageBenefitCny * 0.28),
        Math.round(expectedStorageBenefitCny * 0.34),
        Math.round(expectedStorageBenefitCny * 0.38),
      ]);
    });

    it('reconciles live signed storage benefit from the first through final hour', () => {
      const data = buildScenarioData(scenario, operationMode);
      const { plantCop } = expectedConfig[operationMode];
      const storageBenefitAt = (index: number) => {
        const point = data.hourly[index];
        const noStorageTotalLoadKw =
          point.baseElectricLoadKw + point.thermalLoadKwTh / plantCop + 2;
        const noStorageGridImportKw = Math.max(0, noStorageTotalLoadKw - point.photovoltaicKw);
        return noStorageGridImportKw * point.priceCny - point.gridImportKw * point.priceCny;
      };
      const firstHourBenefitCny = storageBenefitAt(0);
      const firstSnapshot = deriveLiveSnapshot(data, 0);
      const finalSnapshot = deriveLiveSnapshot(data, data.hourly.length - 1);

      expect(firstHourBenefitCny).toBeLessThan(0);
      expect(firstSnapshot.economics.peakValleyBenefitCny).toBeCloseTo(firstHourBenefitCny, 9);
      expect(finalSnapshot.economics.peakValleyBenefitCny).toBeCloseTo(
        data.economics.peakValleyBenefitCny,
        9,
      );
      expect(finalSnapshot.economics.dailySavingCny).toBeCloseTo(data.economics.dailySavingCny, 9);
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
      expect(data.storage.availableHours).toBeCloseTo(
        data.hourly[14].storedEnergyKwhTh * 0.92
          / Math.min(data.hourly[14].thermalLoadKwTh, config.maxDischargePowerKwTh),
        8,
      );

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

  it('applies only the day variation factor to already-priced weekly benefits', () => {
    for (const scenario of scenarios) {
      const data = buildScenarioData(scenario, operationMode);

      data.weekly.forEach((day, index) => {
        const dayFactor = 0.92 + index * 0.03;
        expect(day.benefitCny).toBe(Math.round(data.economics.dailySavingCny * dayFactor));
      });
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

  it('uses heating status semantics throughout heating scenario and live outputs', () => {
    const heating = buildScenarioData('heatwave', 'heating');
    const live = deriveLiveSnapshot(heating, 7);
    const plantNode = heating.nodes.find((node) => node.id === 'ac');

    expect(heating.airConditioning.runningStatus).toMatch(/供热/);
    expect(heating.airConditioning.zones.every((zone) => !zone.status.includes('制冷'))).toBe(true);
    expect(live.airConditioning.runningStatus).toMatch(/供热/);
    expect(live.airConditioning.zones.every((zone) => !zone.status.includes('制冷'))).toBe(true);
    expect(plantNode?.state).toMatch(/供热/);
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
