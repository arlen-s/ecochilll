import { describe, expect, it } from 'vitest';
import { deriveThermalVisualState } from './thermalVisualState';
import type { ThermalStorageMetrics } from '@/types/energy';

const storage = (overrides: Partial<ThermalStorageMetrics> = {}): ThermalStorageMetrics => ({
  operationMode: 'cooling',
  state: 'standby',
  capacityKwhTh: 700,
  storedEnergyKwhTh: 350,
  storageLevelPct: 50,
  chargePowerKwTh: 0,
  dischargePowerKwTh: 0,
  tankVolumeM3: 100,
  supplyTempC: 7,
  returnTempC: 13,
  roundTripEfficiencyPct: 88,
  availableHours: 3,
  ...overrides,
});

describe('thermal scene visual state', () => {
  it('places stored cold water below the return water and its interface at the split', () => {
    const visual = deriveThermalVisualState('cooling', storage({ storageLevelPct: 25 }), 0.38, 3.72);

    expect(visual.storedBottom).toBeCloseTo(0.38);
    expect(visual.storedHeight).toBeCloseTo(0.93);
    expect(visual.returnBottom).toBeCloseTo(1.31);
    expect(visual.interfaceY).toBeCloseTo(1.31);
    expect(visual.surfaceColor).toBe('#29d7ff');
    expect(visual.frameColor).toBe('#3de1ff');
  });

  it('places stored hot water above the return water', () => {
    const visual = deriveThermalVisualState('heating', storage({ storageLevelPct: 25 }), 0.38, 3.72);

    expect(visual.returnBottom).toBeCloseTo(0.38);
    expect(visual.storedBottom).toBeCloseTo(3.17);
    expect(visual.interfaceY).toBeCloseTo(3.17);
    expect(visual.surfaceColor).toBe('#ff8d3a');
    expect(visual.frameColor).toBe('#ff9f43');
  });

  it('lights only the active flow and scales its strength with delivered power', () => {
    const charging = deriveThermalVisualState('cooling', storage({ state: 'charging', chargePowerKwTh: 120 }), 0.38, 3.72);
    const discharging = deriveThermalVisualState('heating', storage({ state: 'discharging', dischargePowerKwTh: 240 }), 0.38, 3.72);
    const standby = deriveThermalVisualState('cooling', storage(), 0.38, 3.72);

    expect(charging.chargeIntensity).toBeCloseTo(0.675);
    expect(charging.dischargeIntensity).toBe(0);
    expect(discharging.chargeIntensity).toBe(0);
    expect(discharging.dischargeIntensity).toBe(1);
    expect(standby.chargeIntensity).toBe(0);
    expect(standby.dischargeIntensity).toBe(0);
  });

  it('clamps invalid or out-of-range storage levels before positioning the layers', () => {
    const empty = deriveThermalVisualState('cooling', storage({ storageLevelPct: Number.NaN }), 0.38, 3.72);
    const full = deriveThermalVisualState('heating', storage({ storageLevelPct: 120 }), 0.38, 3.72);

    expect(empty.storedHeight).toBe(0);
    expect(empty.returnHeight).toBeCloseTo(3.72);
    expect(empty.surfaceVisible).toBe(false);
    expect(full.storedHeight).toBeCloseTo(3.72);
    expect(full.returnHeight).toBe(0);
    expect(full.surfaceVisible).toBe(false);
  });
});
