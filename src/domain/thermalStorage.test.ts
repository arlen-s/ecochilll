import { describe, expect, it } from 'vitest';
import {
  calculateSensibleHeatCapacity,
  deriveAvailableHours,
  stepThermalStorage,
} from './thermalStorage';

describe('thermal storage domain', () => {
  it('calculates water sensible heat capacity', () => {
    expect(calculateSensibleHeatCapacity(100, 6)).toBeCloseTo(697.8);
  });

  it('clamps charging at capacity and reports accepted input power', () => {
    const result = stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 680,
      durationHours: 1,
      chargePowerKwTh: 100,
      dischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossPctPerHour: 0,
    });

    expect(result.storedEnergyKwhTh).toBe(700);
    expect(result.acceptedChargePowerKwTh).toBeCloseTo(21.2765957447);
  });

  it('rejects simultaneous charging and discharging', () => {
    expect(() => stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 350,
      durationHours: 1,
      chargePowerKwTh: 40,
      dischargePowerKwTh: 30,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossPctPerHour: 0,
    })).toThrow('charge and discharge must be mutually exclusive');
  });

  it('derives deliverable hours from stored energy, efficiency, demand, and discharge limit', () => {
    expect(deriveAvailableHours(500, 125, 0.92, 100)).toBeCloseTo(4.6);
    expect(deriveAvailableHours(500, 80, 0.92, 100)).toBeCloseTo(5.75);
  });

  it('returns zero available hours when demand or maximum discharge power is zero', () => {
    expect(deriveAvailableHours(500, 0, 0.92, 100)).toBe(0);
    expect(deriveAvailableHours(500, 125, 0.92, 0)).toBe(0);
  });

  it('clamps discharge to energy remaining after standing loss', () => {
    const result = stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 50,
      durationHours: 1,
      chargePowerKwTh: 0,
      dischargePowerKwTh: 100,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.9,
      standingLossPctPerHour: 0.2,
    });

    expect(result.standingLossKwhTh).toBe(10);
    expect(result.deliveredDischargePowerKwTh).toBeCloseTo(36);
    expect(result.storedEnergyKwhTh).toBe(0);
  });

  it('applies linear per-hour fractional standing loss while on standby', () => {
    const result = stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 100,
      durationHours: 2,
      chargePowerKwTh: 0,
      dischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossPctPerHour: 0.05,
    });

    expect(result.standingLossKwhTh).toBe(10);
    expect(result.storedEnergyKwhTh).toBe(90);
    expect(result.storageLevelPct).toBeCloseTo(12.8571428571);
  });

  it('rejects invalid numeric inputs', () => {
    expect(() => calculateSensibleHeatCapacity(-1, 6)).toThrow();
    expect(() => deriveAvailableHours(500, Number.NaN, 0.92, 100)).toThrow();
    expect(() => deriveAvailableHours(500, 125, 0, 100)).toThrow();
    expect(() => deriveAvailableHours(500, 125, 0.92, Number.NaN)).toThrow();
    expect(() => stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 350,
      durationHours: 0,
      chargePowerKwTh: 0,
      dischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossPctPerHour: 0,
    })).toThrow();
  });
});
