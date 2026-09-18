export const WATER_HEAT_CAPACITY_KWH_PER_M3_K = 1.163;

export interface ThermalStorageStepInput {
  capacityKwhTh: number;
  storedEnergyKwhTh: number;
  durationHours: number;
  chargePowerKwTh: number;
  dischargePowerKwTh: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  standingLossPctPerHour: number;
}

export interface ThermalStorageStepResult {
  storedEnergyKwhTh: number;
  storageLevelPct: number;
  acceptedChargePowerKwTh: number;
  deliveredDischargePowerKwTh: number;
  standingLossKwhTh: number;
}

export function calculateSensibleHeatCapacity(volumeM3: number, temperatureDifferenceK: number): number {
  assertNonNegativeFinite('volumeM3', volumeM3);
  assertNonNegativeFinite('temperatureDifferenceK', temperatureDifferenceK);

  return volumeM3 * temperatureDifferenceK * WATER_HEAT_CAPACITY_KWH_PER_M3_K;
}

export function deriveAvailableHours(storedEnergyKwhTh: number, thermalDemandKwTh: number): number {
  assertNonNegativeFinite('storedEnergyKwhTh', storedEnergyKwhTh);
  assertNonNegativeFinite('thermalDemandKwTh', thermalDemandKwTh);

  return thermalDemandKwTh === 0 ? 0 : storedEnergyKwhTh / thermalDemandKwTh;
}

export function stepThermalStorage(input: ThermalStorageStepInput): ThermalStorageStepResult {
  validateStepInput(input);

  const initialStoredEnergy = clamp(input.storedEnergyKwhTh, 0, input.capacityKwhTh);
  const standingLossKwhTh = Math.min(
    initialStoredEnergy,
    initialStoredEnergy * input.standingLossPctPerHour * input.durationHours,
  );
  const storedAfterStandingLoss = initialStoredEnergy - standingLossKwhTh;

  if (input.chargePowerKwTh > 0) {
    const remainingCapacityKwhTh = input.capacityKwhTh - storedAfterStandingLoss;
    const acceptedChargePowerKwTh = Math.min(
      input.chargePowerKwTh,
      remainingCapacityKwhTh / input.chargeEfficiency / input.durationHours,
    );
    const storedEnergyKwhTh = clamp(
      storedAfterStandingLoss + acceptedChargePowerKwTh * input.durationHours * input.chargeEfficiency,
      0,
      input.capacityKwhTh,
    );

    return createStepResult(storedEnergyKwhTh, input.capacityKwhTh, acceptedChargePowerKwTh, 0, standingLossKwhTh);
  }

  if (input.dischargePowerKwTh > 0) {
    const deliveredDischargePowerKwTh = Math.min(
      input.dischargePowerKwTh,
      storedAfterStandingLoss * input.dischargeEfficiency / input.durationHours,
    );
    const storedEnergyKwhTh = clamp(
      storedAfterStandingLoss - deliveredDischargePowerKwTh * input.durationHours / input.dischargeEfficiency,
      0,
      input.capacityKwhTh,
    );

    return createStepResult(storedEnergyKwhTh, input.capacityKwhTh, 0, deliveredDischargePowerKwTh, standingLossKwhTh);
  }

  return createStepResult(storedAfterStandingLoss, input.capacityKwhTh, 0, 0, standingLossKwhTh);
}

function validateStepInput(input: ThermalStorageStepInput): void {
  assertNonNegativeFinite('capacityKwhTh', input.capacityKwhTh);
  assertNonNegativeFinite('storedEnergyKwhTh', input.storedEnergyKwhTh);
  assertPositiveFinite('durationHours', input.durationHours);
  assertNonNegativeFinite('chargePowerKwTh', input.chargePowerKwTh);
  assertNonNegativeFinite('dischargePowerKwTh', input.dischargePowerKwTh);
  assertEfficiency('chargeEfficiency', input.chargeEfficiency);
  assertEfficiency('dischargeEfficiency', input.dischargeEfficiency);
  assertNonNegativeFinite('standingLossPctPerHour', input.standingLossPctPerHour);

  if (input.chargePowerKwTh > 0 && input.dischargePowerKwTh > 0) {
    throw new Error('charge and discharge must be mutually exclusive');
  }
}

function createStepResult(
  storedEnergyKwhTh: number,
  capacityKwhTh: number,
  acceptedChargePowerKwTh: number,
  deliveredDischargePowerKwTh: number,
  standingLossKwhTh: number,
): ThermalStorageStepResult {
  return {
    storedEnergyKwhTh,
    storageLevelPct: capacityKwhTh === 0 ? 0 : storedEnergyKwhTh / capacityKwhTh * 100,
    acceptedChargePowerKwTh,
    deliveredDischargePowerKwTh,
    standingLossKwhTh,
  };
}

function assertNonNegativeFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number`);
  }
}

function assertEfficiency(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${name} must be a finite number greater than 0 and no more than 1`);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
