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
      requestedChargePowerKwTh: 100,
      requestedDischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossKwTh: 0,
    });

    expect(result.storedEnergyKwhTh).toBe(700);
    expect(result.acceptedChargePowerKwTh).toBeCloseTo(21.2765957447);
  });

  it('rejects simultaneous charging and discharging', () => {
    expect(() => stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 350,
      durationHours: 1,
      requestedChargePowerKwTh: 40,
      requestedDischargePowerKwTh: 30,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossKwTh: 0,
    })).toThrow('charge and discharge must be mutually exclusive');
  });

  it('derives available hours from stored energy and demand', () => {
    expect(deriveAvailableHours(500, 0)).toBe(0);
    expect(deriveAvailableHours(500, 125)).toBe(4);
  });

  it('clamps discharge to energy remaining after standing loss', () => {
    const result = stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 50,
      durationHours: 1,
      requestedChargePowerKwTh: 0,
      requestedDischargePowerKwTh: 100,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.9,
      standingLossKwTh: 10,
    });

    expect(result.standingLossKwhTh).toBe(10);
    expect(result.deliveredDischargePowerKwTh).toBeCloseTo(36);
    expect(result.storedEnergyKwhTh).toBe(0);
  });

  it('applies standing loss while on standby', () => {
    const result = stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 100,
      durationHours: 2,
      requestedChargePowerKwTh: 0,
      requestedDischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossKwTh: 5,
    });

    expect(result.standingLossKwhTh).toBe(10);
    expect(result.storedEnergyKwhTh).toBe(90);
    expect(result.storageLevelPct).toBeCloseTo(12.8571428571);
  });

  it('rejects invalid numeric inputs', () => {
    expect(() => calculateSensibleHeatCapacity(-1, 6)).toThrow();
    expect(() => deriveAvailableHours(500, Number.NaN)).toThrow();
    expect(() => stepThermalStorage({
      capacityKwhTh: 700,
      storedEnergyKwhTh: 350,
      durationHours: 0,
      requestedChargePowerKwTh: 0,
      requestedDischargePowerKwTh: 0,
      chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94,
      standingLossKwTh: 0,
    })).toThrow();
  });
});
