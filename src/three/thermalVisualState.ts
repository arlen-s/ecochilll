import type { OperatingMode, ThermalStorageMetrics } from '@/types/energy';

const clamp01 = (value: number) => Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);

export const deriveThermalVisualState = (
  mode: OperatingMode,
  storage: ThermalStorageMetrics | null,
  internalBottom: number,
  internalHeight: number,
) => {
  const ratio = clamp01((storage?.storageLevelPct ?? 50) / 100);
  const storedHeight = internalHeight * ratio;
  const returnHeight = internalHeight - storedHeight;
  const cooling = mode === 'cooling';
  const storedBottom = cooling ? internalBottom : internalBottom + returnHeight;
  const returnBottom = cooling ? internalBottom + storedHeight : internalBottom;
  const chargePowerFactor = clamp01((storage?.chargePowerKwTh ?? 0) / 240);
  const dischargePowerFactor = clamp01((storage?.dischargePowerKwTh ?? 0) / 240);
  const charging = storage?.state === 'charging' && (storage.chargePowerKwTh ?? 0) > 1;
  const discharging = storage?.state === 'discharging' && (storage.dischargePowerKwTh ?? 0) > 1;

  return {
    storedBottom,
    storedHeight,
    returnBottom,
    returnHeight,
    interfaceY: cooling ? returnBottom : storedBottom,
    surfaceVisible: ratio > 0.01 && ratio < 0.99,
    surfaceColor: cooling ? '#29d7ff' : '#ff8d3a',
    returnedColor: cooling ? '#315b9e' : '#c43d52',
    frameColor: cooling ? '#3de1ff' : '#ff9f43',
    chargeColor: cooling ? '#28e0ff' : '#ff9f43',
    dischargeColor: cooling ? '#4d8dff' : '#ff5d5d',
    chargePowerFactor,
    dischargePowerFactor,
    chargeIntensity: charging ? 0.35 + chargePowerFactor * 0.65 : 0,
    dischargeIntensity: discharging ? 0.35 + dischargePowerFactor * 0.65 : 0,
  };
};
