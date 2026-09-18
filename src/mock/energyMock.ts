import type {
  AiDecisionOutput,
  AirConditionMetrics,
  AirConditionStatus,
  DashboardRuntimeMeta,
  DashboardScenarioData,
  DataSourceMode,
  EconomicMetrics,
  EnergyMixItem,
  HourlyPoint,
  LiveDashboardSnapshot,
  OperatingMode,
  PresentationChapter,
  ScenarioMode,
  SystemAlert,
  SystemNodeStatus,
  ThermalStorageMetrics,
  ThermalStorageState,
  WeatherSnapshot,
  WeeklyStat,
} from '@/types/energy';
import {
  calculateSensibleHeatCapacity,
  deriveAvailableHours,
  stepThermalStorage,
} from '@/domain/thermalStorage';
import { clamp } from '@/utils/format';

interface ThermalStorageConfig {
  tankVolumeM3: number;
  supplyTempC: number;
  returnTempC: number;
  plantCop: number;
  maxChargePowerKwTh: number;
  maxDischargePowerKwTh: number;
}

interface ScenarioMeta {
  label: string;
  summary: string;
  pvFactor: number;
  loadFactor: number;
  priceFactor: number;
  cloud: number;
  ambientBias: number;
  storageTargetPct: number;
  comfortBias: number;
  savingBias: number;
}

const THERMAL_STORAGE_CONFIG: Record<OperatingMode, ThermalStorageConfig> = {
  cooling: {
    tankVolumeM3: 180,
    supplyTempC: 6,
    returnTempC: 13,
    plantCop: 5.2,
    maxChargePowerKwTh: 180,
    maxDischargePowerKwTh: 220,
  },
  heating: {
    tankVolumeM3: 180,
    supplyTempC: 45,
    returnTempC: 35,
    plantCop: 3.4,
    maxChargePowerKwTh: 210,
    maxDischargePowerKwTh: 240,
  },
};

// Hourly tank assumptions. The loss is fractional: 0.001 means 0.1% per hour.
const CHARGE_EFFICIENCY = 0.94;
const DISCHARGE_EFFICIENCY = 0.92;
const STANDING_LOSS_PCT_PER_HOUR = 0.001;
const STEP_DURATION_HOURS = 1;
const INITIAL_STORAGE_LEVEL = 0.32;
const GRID_EMISSION_FACTOR_KG_PER_KWH = 0.62;
const BASE_PUMP_ELECTRIC_POWER_KW = 2;

const electricalPeakHours = new Set([10, 11, 14, 15, 16, 18, 19, 20]);

const baseScenarioMeta: Record<ScenarioMode, Omit<ScenarioMeta, 'label' | 'summary' | 'ambientBias'>> = {
  normal: {
    pvFactor: 1,
    loadFactor: 1,
    priceFactor: 1,
    cloud: 0.2,
    storageTargetPct: 85,
    comfortBias: 0,
    savingBias: 0,
  },
  heatwave: {
    pvFactor: 1.08,
    loadFactor: 1.2,
    priceFactor: 1.05,
    cloud: 0.16,
    storageTargetPct: 88,
    comfortBias: -2,
    savingBias: 0,
  },
  cloudy: {
    pvFactor: 0.58,
    loadFactor: 1,
    priceFactor: 1,
    cloud: 0.72,
    storageTargetPct: 82,
    comfortBias: -3,
    savingBias: -0.8,
  },
  peakPricing: {
    pvFactor: 0.96,
    loadFactor: 1.04,
    priceFactor: 1.36,
    cloud: 0.28,
    storageTargetPct: 90,
    comfortBias: -4.5,
    savingBias: 2.4,
  },
};

const getScenarioMeta = (scenario: ScenarioMode, operationMode: OperatingMode): ScenarioMeta => {
  const shared = baseScenarioMeta[scenario];

  if (operationMode === 'heating') {
    const modeCopy: Record<ScenarioMode, Pick<ScenarioMeta, 'label' | 'summary' | 'ambientBias'>> = {
      normal: {
        label: '常规供热模式',
        summary: '光伏、热泵与蓄热水罐按常规冬季工况协同运行，兼顾室温与基础节能收益。',
        ambientBias: 0,
      },
      heatwave: {
        label: '寒潮模式',
        summary: '寒潮推升供热负荷，AI 提前充热并在用热高峰放热，保障关键区域室温稳定。',
        ambientBias: -8,
      },
      cloudy: {
        label: '冬季云层遮挡模式',
        summary: '厚云削弱光伏出力，蓄热水罐通过放热降低热泵电耗，电网负责剩余电力缺口。',
        ambientBias: -2,
      },
      peakPricing: {
        label: '供热高峰电价模式',
        summary: '高价窗口优先调用可用热量，减少热泵峰时用电并维持供热舒适度。',
        ambientBias: -1,
      },
    };

    return { ...shared, ...modeCopy[scenario] };
  }

  const modeCopy: Record<ScenarioMode, Pick<ScenarioMeta, 'label' | 'summary' | 'ambientBias'>> = {
    normal: {
      label: '正常制冷模式',
      summary: '光伏、冷站与蓄冷水罐按常规工况协同运行，优先保障舒适度与基础节能收益。',
      ambientBias: 0,
    },
    heatwave: {
      label: '高温模式',
      summary: '午后高温推升供冷负荷，AI 提前充冷并在高温高峰放冷，稳住关键区域舒适度。',
      ambientBias: 7,
    },
    cloudy: {
      label: '云层遮挡模式',
      summary: '午后云层遮挡导致光伏骤降，蓄冷水罐通过放冷降低冷站电耗，电网负责剩余电力缺口。',
      ambientBias: 0,
    },
    peakPricing: {
      label: '制冷高峰电价模式',
      summary: '高价窗口优先调用可用冷量，减少冷站峰时用电并兼顾室内舒适度。',
      ambientBias: 1,
    },
  };

  return { ...shared, ...modeCopy[scenario] };
};

const getModeTerms = (operationMode: OperatingMode) => operationMode === 'cooling'
  ? {
      charge: '充冷',
      discharge: '放冷',
      available: '可用冷量',
      plant: '冷站',
      demand: '供冷',
      medium: '冷水',
    }
  : {
      charge: '充热',
      discharge: '放热',
      available: '可用热量',
      plant: '热泵站',
      demand: '供热',
      medium: '热水',
    };

const hourLabel = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

const getPrice = (hour: number, factor: number) => {
  if (hour <= 6) return 0.42 * factor;
  if (hour <= 9) return 0.68 * factor;
  if (hour <= 16) return 0.92 * factor;
  if (hour <= 21) return 1.15 * factor;
  return 0.61 * factor;
};

const getCloudOcclusionFactor = (scenario: ScenarioMode, hour: number) => {
  if (scenario !== 'cloudy') return 1;

  const occlusionProfile: Partial<Record<number, number>> = {
    11: 0.84,
    12: 0.72,
    13: 0.5,
    14: 0.34,
    15: 0.42,
    16: 0.54,
    17: 0.68,
  };

  return occlusionProfile[hour] ?? 1;
};

const getAmbientTemperature = (
  operationMode: OperatingMode,
  hour: number,
  meta: ScenarioMeta,
) => {
  if (operationMode === 'heating') {
    return Number((8 + Math.cos(((hour - 14) / 24) * Math.PI * 2) * 3 + meta.ambientBias).toFixed(1));
  }

  return Number((23 + Math.sin(((hour - 7) / 12) * Math.PI) * 8 + meta.ambientBias).toFixed(1));
};

const getOccupancyCurve = (hour: number) =>
  hour >= 7 && hour <= 21
    ? 0.72 + Math.sin(((hour - 7) / 14) * Math.PI) * 0.24
    : 0.32;

const getThermalLoad = (
  operationMode: OperatingMode,
  hour: number,
  ambientTempC: number,
  meta: ScenarioMeta,
) => {
  const occupancy = getOccupancyCurve(hour);
  if (operationMode === 'heating') {
    const morningBoost = hour >= 6 && hour <= 9 ? 42 : 0;
    return (170 + occupancy * 105 + Math.max(18 - ambientTempC, 0) * 18 + morningBoost) * meta.loadFactor;
  }

  const afternoonBoost = hour >= 11 && hour <= 18 ? 36 : 0;
  return (185 + occupancy * 112 + Math.max(ambientTempC - 24, 0) * 17 + afternoonBoost) * meta.loadFactor;
};

const getBaseElectricLoad = (hour: number, meta: ScenarioMeta) => {
  const occupancy = getOccupancyCurve(hour);
  return (68 + occupancy * 74) * (0.96 + (meta.loadFactor - 1) * 0.24);
};

const isDischargeWindow = (
  scenario: ScenarioMode,
  operationMode: OperatingMode,
  hour: number,
) => {
  if (scenario === 'cloudy' && hour >= 13 && hour <= 16) return true;
  if (scenario === 'peakPricing' && hour >= 18 && hour <= 21) return true;
  if (scenario === 'heatwave') {
    return operationMode === 'cooling'
      ? hour >= 14 && hour <= 20
      : (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 21);
  }
  return electricalPeakHours.has(hour);
};

const getStatusByLoad = (loadKwTh: number): AirConditionStatus => {
  if (loadKwTh >= 500) return '制冷增强';
  if (loadKwTh >= 360) return '常规制冷';
  if (loadKwTh >= 220) return '节能模式';
  return '待机巡检';
};

const getStorageState = (chargeKwTh: number, dischargeKwTh: number): ThermalStorageState => {
  if (chargeKwTh > 0) return 'charging';
  if (dischargeKwTh > 0) return 'discharging';
  return 'standby';
};

const getStorageStateLabel = (
  operationMode: OperatingMode,
  chargeKwTh: number,
  dischargeKwTh: number,
) => {
  const terms = getModeTerms(operationMode);
  if (chargeKwTh > 0) return `${terms.charge}运行`;
  if (dischargeKwTh > 0) return `${terms.discharge}削峰`;
  return '水力待机';
};

const getPhotovoltaicEfficiencyPct = (panelTempC: number, meta: ScenarioMeta) =>
  clamp(21 + meta.pvFactor * 0.4 - meta.cloud - Math.max(panelTempC - 25, 0) * 0.045, 17.5, 20.8);

const calculatePointPeakReductionPct = (point: HourlyPoint, plantCop: number) => {
  const noStoragePlantElectricKw = point.thermalLoadKwTh / plantCop;
  if (noStoragePlantElectricKw === 0) return 0;
  return clamp(
    (noStoragePlantElectricKw - point.plantElectricPowerKw) / noStoragePlantElectricKw * 100,
    0,
    100,
  );
};

interface HourlyEconomicsInput {
  photovoltaicKw: number;
  baseElectricLoadKw: number;
  gridImportKw: number;
  thermalLoadKwTh: number;
  priceCny: number;
}

interface HourlyEconomicsComparison {
  actualGridCostCny: number;
  noPvNoStorageGridCostCny: number;
  samePvNoStorageGridCostCny: number;
  overallSavingCny: number;
  storageBenefitCny: number;
}

const compareHourlyGridCosts = (
  point: HourlyEconomicsInput,
  plantCop: number,
): HourlyEconomicsComparison => {
  const noStorageTotalLoadKw =
    point.baseElectricLoadKw + point.thermalLoadKwTh / plantCop + BASE_PUMP_ELECTRIC_POWER_KW;
  const noStorageGridImportKw = Math.max(0, noStorageTotalLoadKw - point.photovoltaicKw);
  const actualGridCostCny = point.gridImportKw * point.priceCny;
  const noPvNoStorageGridCostCny = noStorageTotalLoadKw * point.priceCny;
  const samePvNoStorageGridCostCny = noStorageGridImportKw * point.priceCny;

  return {
    actualGridCostCny,
    noPvNoStorageGridCostCny,
    samePvNoStorageGridCostCny,
    overallSavingCny: noPvNoStorageGridCostCny - actualGridCostCny,
    storageBenefitCny: samePvNoStorageGridCostCny - actualGridCostCny,
  };
};

export const buildHourlySeries = (
  scenario: ScenarioMode,
  operationMode: OperatingMode,
): HourlyPoint[] => {
  const meta = getScenarioMeta(scenario, operationMode);
  const config = THERMAL_STORAGE_CONFIG[operationMode];
  const capacityKwhTh = calculateSensibleHeatCapacity(
    config.tankVolumeM3,
    Math.abs(config.returnTempC - config.supplyTempC),
  );
  const targetStoredEnergyKwhTh = capacityKwhTh * meta.storageTargetPct / 100;
  let storedEnergyKwhTh = capacityKwhTh * INITIAL_STORAGE_LEVEL;

  return Array.from({ length: 24 }, (_, hour) => {
    const solarCurve = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const occlusionFactor = getCloudOcclusionFactor(scenario, hour);
    const photovoltaicKw = Math.round((solarCurve ** 1.5) * 620 * meta.pvFactor * occlusionFactor);
    const ambientTempC = getAmbientTemperature(operationMode, hour, meta);
    const thermalLoadKwTh = getThermalLoad(operationMode, hour, ambientTempC, meta);
    const baseElectricLoadKw = getBaseElectricLoad(hour, meta);
    const noDispatchPumpElectricPowerKw = BASE_PUMP_ELECTRIC_POWER_KW;
    const noStoragePlantElectricPowerKw = thermalLoadKwTh / config.plantCop;
    const noDispatchElectricLoadKw =
      baseElectricLoadKw + noStoragePlantElectricPowerKw + noDispatchPumpElectricPowerKw;
    const hasGridStress = photovoltaicKw < noDispatchElectricLoadKw;
    const wantsDischarge = isDischargeWindow(scenario, operationMode, hour) && hasGridStress;
    const requestedDischargeKwTh = wantsDischarge
      ? Math.min(config.maxDischargePowerKwTh, thermalLoadKwTh * (scenario === 'peakPricing' ? 0.46 : 0.38))
      : 0;

    let requestedChargeKwTh = 0;
    if (!wantsDischarge && storedEnergyKwhTh < targetStoredEnergyKwhTh) {
      const roomLimitedChargeKwTh = Math.max(
        0,
        (targetStoredEnergyKwhTh - storedEnergyKwhTh) / CHARGE_EFFICIENCY / STEP_DURATION_HOURS,
      );
      if (hour <= 6) {
        const valleyChargeKwTh = operationMode === 'cooling' ? 55 : 65;
        requestedChargeKwTh = Math.min(config.maxChargePowerKwTh, valleyChargeKwTh, roomLimitedChargeKwTh);
      } else {
        const surplusPvKw = Math.max(0, photovoltaicKw - noDispatchElectricLoadKw);
        const marginalElectricKwPerKwTh = 1 / config.plantCop + 0.018;
        requestedChargeKwTh = Math.min(
          config.maxChargePowerKwTh,
          roomLimitedChargeKwTh,
          surplusPvKw / marginalElectricKwPerKwTh,
        );
      }
    }

    const storageStep = stepThermalStorage({
      capacityKwhTh,
      storedEnergyKwhTh,
      durationHours: STEP_DURATION_HOURS,
      chargePowerKwTh: requestedChargeKwTh,
      dischargePowerKwTh: requestedDischargeKwTh,
      chargeEfficiency: CHARGE_EFFICIENCY,
      dischargeEfficiency: DISCHARGE_EFFICIENCY,
      standingLossPctPerHour: STANDING_LOSS_PCT_PER_HOUR,
    });
    storedEnergyKwhTh = storageStep.storedEnergyKwhTh;

    const storageChargeKwTh = storageStep.acceptedChargePowerKwTh;
    const storageDischargeKwTh = storageStep.deliveredDischargePowerKwTh;
    const plantDirectThermalKwTh = thermalLoadKwTh - storageDischargeKwTh;
    const plantElectricPowerKw =
      (plantDirectThermalKwTh + storageChargeKwTh) / config.plantCop;
    const pumpElectricPowerKw =
      BASE_PUMP_ELECTRIC_POWER_KW + (storageChargeKwTh + storageDischargeKwTh) * 0.018;
    const totalElectricLoadKw =
      baseElectricLoadKw + plantElectricPowerKw + pumpElectricPowerKw;
    const electricDifferenceKw = photovoltaicKw - totalElectricLoadKw;
    const gridImportKw = Math.max(0, -electricDifferenceKw);
    const gridExportKw = Math.max(0, electricDifferenceKw);
    const directPvDisplacementKw = Math.min(photovoltaicKw, totalElectricLoadKw);
    const priceCny = Number(getPrice(hour, meta.priceFactor).toFixed(2));
    const economicsComparison = compareHourlyGridCosts({
      photovoltaicKw,
      baseElectricLoadKw,
      gridImportKw,
      thermalLoadKwTh,
      priceCny,
    }, config.plantCop);

    return {
      hour: hourLabel(hour),
      photovoltaicKw,
      baseElectricLoadKw,
      plantElectricPowerKw,
      pumpElectricPowerKw,
      totalElectricLoadKw,
      gridImportKw,
      gridExportKw,
      thermalLoadKwTh,
      plantDirectThermalKwTh,
      storageChargeKwTh,
      storageDischargeKwTh,
      storedEnergyKwhTh,
      storageLevelPct: storageStep.storageLevelPct,
      carbonReductionKg: directPvDisplacementKw * GRID_EMISSION_FACTOR_KG_PER_KWH,
      savingCny: economicsComparison.overallSavingCny,
      priceCny,
      irradianceWm2: Math.round(920 * solarCurve * meta.pvFactor * occlusionFactor),
      ambientTempC,
    };
  });
};

const buildWeeklyStats = (
  operationMode: OperatingMode,
  hourly: HourlyPoint[],
): WeeklyStat[] => {
  const config = THERMAL_STORAGE_CONFIG[operationMode];
  const basePv = hourly.reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const baseLoad = hourly.reduce((sum, item) => sum + item.totalElectricLoadKw, 0);
  const peakReductionPct = Math.max(
    ...hourly.map((item) => calculatePointPeakReductionPct(item, config.plantCop)),
  );

  return Array.from({ length: 7 }, (_, index) => {
    const dayFactor = 0.92 + index * 0.03;
    return {
      date: `04-${(11 + index).toString().padStart(2, '0')}`,
      pvGenerationKwh: Math.round(basePv * dayFactor),
      loadConsumptionKwh: Math.round(baseLoad * (0.94 + index * 0.012)),
      peakReductionPct: Number(clamp(peakReductionPct * (0.94 + index * 0.01), 0, 100).toFixed(1)),
      carbonReductionKg: Math.round(
        hourly.reduce((sum, item) => sum + item.carbonReductionKg, 0) * dayFactor,
      ),
      benefitCny: Math.round(hourly.reduce((sum, item) => sum + item.savingCny, 0) * dayFactor),
    };
  });
};

const buildAiDecision = (
  scenario: ScenarioMode,
  operationMode: OperatingMode,
  hourly: HourlyPoint[],
): AiDecisionOutput => {
  const meta = getScenarioMeta(scenario, operationMode);
  const terms = getModeTerms(operationMode);
  const totalSaving = hourly.reduce((sum, item) => sum + item.savingCny, 0);
  const totalCarbon = hourly.reduce((sum, item) => sum + item.carbonReductionKg, 0);
  const confidenceByScenario: Record<ScenarioMode, number> = {
    normal: 93,
    heatwave: 94,
    cloudy: 89,
    peakPricing: 96,
  };
  const statusByScenario: Record<ScenarioMode, string> = {
    normal: '平稳运行',
    heatwave: '负荷保障中',
    cloudy: '应急调度中',
    peakPricing: '收益优先',
  };

  return {
    title: `AI ${meta.label}${terms.demand}策略`,
    status: statusByScenario[scenario],
    confidencePct: confidenceByScenario[scenario],
    summary: `${terms.plant}、光伏与分层蓄能水罐协同运行；谷段从电网取电${terms.charge}，光伏富余时独立执行绿电${terms.charge}，峰段按${terms.available}决定${terms.discharge}功率。`,
    recommendation: `${scenario === 'cloudy' ? '云层遮挡期间保留安全余量；' : ''}建议维持关键区域优先级，并根据储能率动态调整${terms.discharge}强度。`,
    expectedBenefitCny: Math.round(totalSaving),
    expectedCarbonKg: Math.round(totalCarbon),
    strategyRules: [
      {
        id: `${operationMode}-${scenario}-valley`,
        title: `谷价电网${terms.charge}`,
        score: 90,
        description: `仅在 00:00-06:00 谷价时段由电网驱动${terms.plant}${terms.charge}，并受水罐剩余空间约束。`,
        expectedSavingPct: 9.2,
        expectedBenefitCny: Math.round(totalSaving * 0.28),
        flow: 'charge',
      },
      {
        id: `${operationMode}-${scenario}-pv`,
        title: `富余光伏${terms.charge}`,
        score: 94,
        description: `光伏覆盖园区实时电负荷后，才用真实电力余量驱动${terms.plant}${terms.charge}。`,
        expectedSavingPct: 13.6,
        expectedBenefitCny: Math.round(totalSaving * 0.34),
        flow: 'charge',
      },
      {
        id: `${operationMode}-${scenario}-peak`,
        title: `峰时${terms.discharge}削峰`,
        score: scenario === 'peakPricing' ? 98 : 92,
        description: `在峰价或负荷压力窗口按${terms.available}执行${terms.discharge}，直接降低${terms.plant}电功率。`,
        expectedSavingPct: scenario === 'peakPricing' ? 21.3 : 15.4,
        expectedBenefitCny: Math.round(totalSaving * 0.38),
        flow: 'discharge',
      },
    ],
    timeline: [
      {
        time: '05:40',
        title: `谷价${terms.charge}收尾`,
        level: 'info',
        summary: `水罐储能率达到日间运行目标下限，停止额外谷电${terms.charge}。`,
        benefit: '控制低价补能成本',
      },
      {
        time: '12:40',
        title: `光伏富余${terms.charge}`,
        level: 'medium',
        summary: `光伏覆盖实时电负荷后，剩余电力驱动${terms.plant}向水罐换热。`,
        benefit: '提升绿电自用率',
      },
      {
        time: scenario === 'cloudy' ? '14:00' : '18:10',
        title: `${terms.discharge}削峰启动`,
        level: 'high',
        summary: `${terms.available}满足调度阈值，水泵启动并通过换热回路承担部分${terms.demand}负荷。`,
        benefit: `降低${terms.plant}峰时电耗`,
      },
    ],
  };
};

const buildEnergyMix = (hourly: HourlyPoint[]): EnergyMixItem[] => {
  const photovoltaicSelfUseKwh = hourly.reduce(
    (sum, item) => sum + Math.min(item.photovoltaicKw, item.totalElectricLoadKw),
    0,
  );
  const gridImportKwh = hourly.reduce((sum, item) => sum + item.gridImportKw, 0);
  const totalSupplyKwh = photovoltaicSelfUseKwh + gridImportKwh;

  if (totalSupplyKwh === 0) {
    return [{ name: '园区电负荷', value: 100, color: '#46b3ff' }];
  }

  return [
    {
      name: '光伏自用电量',
      value: Number((photovoltaicSelfUseKwh / totalSupplyKwh * 100).toFixed(1)),
      color: '#15f5ba',
    },
    {
      name: '电网购电量',
      value: Number((gridImportKwh / totalSupplyKwh * 100).toFixed(1)),
      color: '#ffd66b',
    },
  ];
};

const buildNodes = (
  scenario: ScenarioMode,
  operationMode: OperatingMode,
  hourly: HourlyPoint[],
  photovoltaicEfficiencyPct: number,
): SystemNodeStatus[] => {
  const live = hourly[14];
  const meta = getScenarioMeta(scenario, operationMode);
  const terms = getModeTerms(operationMode);

  return [
    {
      id: 'pv',
      label: '屋顶光伏阵列',
      type: 'pv',
      powerValue: live.photovoltaicKw,
      powerUnit: 'kW',
      state: live.photovoltaicKw > 280 ? '高效发电' : '波动发电',
      efficiencyPct: photovoltaicEfficiencyPct,
      detail: '双层屋顶光伏矩阵，为园区电负荷与热泵机组提供可再生电力。',
    },
    {
      id: 'building-a',
      label: '教学楼 A',
      type: 'building',
      powerValue: live.baseElectricLoadKw * 0.36,
      powerUnit: 'kW',
      state: '教学运行',
      efficiencyPct: 88,
      detail: `主教学楼，${terms.demand}需求受课表、室外温度与人员密度共同影响。`,
    },
    {
      id: 'building-b',
      label: '图书馆',
      type: 'building',
      powerValue: live.baseElectricLoadKw * 0.27,
      powerUnit: 'kW',
      state: '阅读高峰',
      efficiencyPct: 90,
      detail: `图书馆对舒适度更敏感，AI 优先保障阅览区${terms.demand}稳定。`,
    },
    {
      id: 'building-c',
      label: '实验楼',
      type: 'building',
      powerValue: live.baseElectricLoadKw * 0.22,
      powerUnit: 'kW',
      state: '实验运行',
      efficiencyPct: 87,
      detail: `实验楼负荷波动较大，是${terms.discharge}削峰的重点保障对象。`,
    },
    {
      id: 'ac',
      label: terms.plant,
      type: 'ac',
      powerValue: live.thermalLoadKwTh,
      powerUnit: 'kWth',
      state: getStatusByLoad(live.thermalLoadKwTh),
      efficiencyPct: clamp(84 - (meta.loadFactor - 1) * 18, 72, 92),
      detail: `${terms.plant}联动楼栋末端与分层水系统，按实时${terms.demand}负荷调节输出。`,
    },
    {
      id: 'storage',
      label: '分层蓄能水罐',
      type: 'storage',
      powerValue: live.storageDischargeKwTh || live.storageChargeKwTh,
      powerUnit: 'kWth',
      state: getStorageStateLabel(operationMode, live.storageChargeKwTh, live.storageDischargeKwTh),
      efficiencyPct: CHARGE_EFFICIENCY * DISCHARGE_EFFICIENCY * 100,
      detail: `分层${terms.medium}水罐通过变频水泵和板式换热回路完成${terms.charge}、${terms.discharge}与峰荷调节。`,
    },
    {
      id: 'grid',
      label: '园区电网接口',
      type: 'grid',
      powerValue: live.gridImportKw,
      powerUnit: 'kW',
      state: live.gridImportKw > 120 ? '托底供电' : live.gridExportKw > 0 ? '余电上网' : '低负载接入',
      efficiencyPct: 100,
      detail: '接入园区配电网，用于兜底供电、余电上网与需量优化。',
    },
  ];
};

const buildStorageMetrics = (
  operationMode: OperatingMode,
  point: HourlyPoint,
): ThermalStorageMetrics => {
  const config = THERMAL_STORAGE_CONFIG[operationMode];
  const capacityKwhTh = calculateSensibleHeatCapacity(
    config.tankVolumeM3,
    Math.abs(config.returnTempC - config.supplyTempC),
  );

  return {
    operationMode,
    state: getStorageState(point.storageChargeKwTh, point.storageDischargeKwTh),
    capacityKwhTh,
    storedEnergyKwhTh: point.storedEnergyKwhTh,
    storageLevelPct: point.storageLevelPct,
    chargePowerKwTh: point.storageChargeKwTh,
    dischargePowerKwTh: point.storageDischargeKwTh,
    tankVolumeM3: config.tankVolumeM3,
    supplyTempC: config.supplyTempC,
    returnTempC: config.returnTempC,
    roundTripEfficiencyPct: CHARGE_EFFICIENCY * DISCHARGE_EFFICIENCY * 100,
    availableHours: deriveAvailableHours(point.storedEnergyKwhTh, point.thermalLoadKwTh),
  };
};

export const buildScenarioData = (
  scenario: ScenarioMode,
  operationMode: OperatingMode = 'cooling',
): DashboardScenarioData => {
  const meta = getScenarioMeta(scenario, operationMode);
  const config = THERMAL_STORAGE_CONFIG[operationMode];
  const hourly = buildHourlySeries(scenario, operationMode);
  const weekly = buildWeeklyStats(operationMode, hourly);
  const live = hourly[14];
  const pvDay = hourly.reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const savingTotal = hourly.reduce((sum, item) => sum + item.savingCny, 0);
  const storageBenefitTotal = hourly.reduce(
    (sum, item) => sum + compareHourlyGridCosts(item, config.plantCop).storageBenefitCny,
    0,
  );
  const carbonTotal = hourly.reduce((sum, item) => sum + item.carbonReductionKg, 0);
  const panelTempC = Number((live.ambientTempC + 13 + meta.pvFactor * 4).toFixed(1));
  const photovoltaicEfficiencyPct = Number(getPhotovoltaicEfficiencyPct(panelTempC, meta).toFixed(1));
  const energyMix = buildEnergyMix(hourly);
  const renewableRatioPct = energyMix.find((item) => item.name === '光伏自用电量')?.value ?? 0;
  const peakReductionPct = calculatePointPeakReductionPct(live, config.plantCop);

  const weather: WeatherSnapshot = {
    weatherText: scenario === 'cloudy'
      ? '云层遮挡'
      : scenario === 'heatwave'
        ? operationMode === 'cooling' ? '晴热高温' : '寒潮低温'
        : operationMode === 'cooling' ? '晴间多云' : '冬日晴间多云',
    irradianceWm2: live.irradianceWm2,
    ambientTempC: live.ambientTempC,
    indoorTempC: operationMode === 'cooling'
      ? Number((24.6 + (scenario === 'heatwave' ? 0.7 : 0)).toFixed(1))
      : Number((21.2 - (scenario === 'heatwave' ? 0.5 : 0)).toFixed(1)),
    humidityPct: clamp(46 + meta.cloud * 18, 34, 76),
    windSpeedMs: Number((2.8 + meta.cloud * 2.6).toFixed(1)),
    lightLevelPct: clamp(92 * meta.pvFactor, 42, 96),
    comfortIndex: clamp(91 + meta.comfortBias - meta.cloud * 2.2, 76, 93),
    cloudCoverPct: Math.round(meta.cloud * 100),
  };

  const zoneFractions = [0.34, 0.27, 0.22, 0.17];
  const zoneNames = ['教学楼 A', '图书馆', '实验楼', '行政楼'];
  const airConditioning: AirConditionMetrics = {
    thermalLoadKwTh: live.thermalLoadKwTh,
    outdoorTempC: live.ambientTempC,
    indoorAvgTempC: weather.indoorTempC,
    humidityPct: weather.humidityPct,
    comfortPct: weather.comfortIndex,
    runningStatus: getStatusByLoad(live.thermalLoadKwTh),
    zones: zoneFractions.map((fraction, index) => ({
      id: `z${index + 1}`,
      name: zoneNames[index],
      loadKwTh: live.thermalLoadKwTh * fraction,
      status: getStatusByLoad(live.thermalLoadKwTh * fraction),
      indoorTempC: Number((weather.indoorTempC + [0.3, -0.2, 0.1, 0.4][index]).toFixed(1)),
      targetTempC: operationMode === 'cooling'
        ? [25, 24.5, 24.8, 25.8][index]
        : [21, 21.5, 20.5, 20][index],
      humidityPct: clamp(weather.humidityPct + [3, 0, -2, 1][index], 34, 75),
      comfortPct: clamp(weather.comfortIndex + [-2, 3, 0, -4][index], 68, 96),
      occupancyPct: [82, 74, 68, 51][index],
    })),
  };

  const economics: EconomicMetrics = {
    dailySavingCny: savingTotal,
    monthlySavingCny: Math.round(savingTotal * 29.4),
    peakValleyBenefitCny: storageBenefitTotal,
    roiTrendPct: Number((12.6 + meta.priceFactor * 2.3 + meta.savingBias).toFixed(1)),
    annualForecastCny: Math.round(savingTotal * 365 * 0.84),
  };

  return {
    scenario,
    operationMode,
    scenarioLabel: meta.label,
    scenarioSummary: meta.summary,
    coreKpi: {
      totalPowerKw: live.totalElectricLoadKw,
      peakReductionPct: Number(peakReductionPct.toFixed(1)),
      carbonReductionKg: Math.round(carbonTotal),
      economicGainCny: economics.dailySavingCny,
      greenEnergyRatioPct: renewableRatioPct,
    },
    weather,
    photovoltaic: {
      powerKw: live.photovoltaicKw,
      todayGenerationKwh: Math.round(pvDay),
      efficiencyPct: photovoltaicEfficiencyPct,
      irradianceWm2: live.irradianceWm2,
      panelTempC,
      fluctuationPct: Number((4.2 + meta.cloud * 5.8 + (scenario === 'cloudy' ? 7.4 : 0)).toFixed(1)),
    },
    airConditioning,
    storage: buildStorageMetrics(operationMode, live),
    environment: {
      carbonReductionKg: Math.round(carbonTotal),
      treeEquivalent: Math.round(carbonTotal / 18),
      renewableRatioPct,
      pm25: Math.round(17 + meta.cloud * 15),
      ambientTempC: weather.ambientTempC,
      lightLevelPct: weather.lightLevelPct,
    },
    economics,
    energyMix,
    hourly,
    weekly,
    ai: buildAiDecision(scenario, operationMode, hourly),
    nodes: buildNodes(scenario, operationMode, hourly, photovoltaicEfficiencyPct),
  };
};

export const deriveLiveSnapshot = (
  data: DashboardScenarioData,
  hourIndex: number,
): LiveDashboardSnapshot => {
  const point = data.hourly[hourIndex];
  const config = THERMAL_STORAGE_CONFIG[data.operationMode];
  const pvProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const savingProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.savingCny, 0);
  const storageBenefitProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce(
      (sum, item) => sum + compareHourlyGridCosts(item, config.plantCop).storageBenefitCny,
      0,
    );
  const carbonProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.carbonReductionKg, 0);
  const comfort = clamp(
    data.weather.comfortIndex - (point.thermalLoadKwTh > 500 ? 2.2 : 0) + (point.photovoltaicKw > 280 ? 1.2 : 0),
    72,
    96,
  );
  const photovoltaicSharePct = clamp(
    Math.min(point.photovoltaicKw, point.totalElectricLoadKw) / Math.max(point.totalElectricLoadKw, 1) * 100,
    0,
    100,
  );

  return {
    hourLabel: point.hour,
    operationMode: data.operationMode,
    coreKpi: {
      totalPowerKw: point.totalElectricLoadKw,
      peakReductionPct: Number(calculatePointPeakReductionPct(point, config.plantCop).toFixed(1)),
      carbonReductionKg: Math.round(carbonProgress),
      economicGainCny: Math.round(savingProgress),
      greenEnergyRatioPct: Number(photovoltaicSharePct.toFixed(1)),
    },
    weather: {
      ...data.weather,
      irradianceWm2: point.irradianceWm2,
      ambientTempC: point.ambientTempC,
      comfortIndex: Number(comfort.toFixed(1)),
    },
    photovoltaic: {
      ...data.photovoltaic,
      powerKw: point.photovoltaicKw,
      irradianceWm2: point.irradianceWm2,
      todayGenerationKwh: Math.round(pvProgress),
      fluctuationPct: Number(
        (data.photovoltaic.fluctuationPct + Math.abs(point.photovoltaicKw - data.photovoltaic.powerKw) * 0.01).toFixed(1),
      ),
    },
    airConditioning: {
      ...data.airConditioning,
      thermalLoadKwTh: point.thermalLoadKwTh,
      outdoorTempC: point.ambientTempC,
      comfortPct: Number(comfort.toFixed(1)),
      runningStatus: getStatusByLoad(point.thermalLoadKwTh),
      zones: data.airConditioning.zones.map((zone, index) => ({
        ...zone,
        loadKwTh: point.thermalLoadKwTh * [0.34, 0.27, 0.22, 0.17][index],
        comfortPct: clamp(
          zone.comfortPct + (index === 1 ? 2 : -1) + (point.photovoltaicKw > 300 ? 2 : 0),
          68,
          96,
        ),
      })),
    },
    storage: buildStorageMetrics(data.operationMode, point),
    environment: {
      ...data.environment,
      carbonReductionKg: Math.round(carbonProgress),
      treeEquivalent: Math.round(carbonProgress / 18),
      ambientTempC: point.ambientTempC,
      lightLevelPct: clamp(point.irradianceWm2 / 9.8, 12, 100),
    },
    economics: {
      ...data.economics,
      dailySavingCny: savingProgress,
      peakValleyBenefitCny: storageBenefitProgress,
    },
    gridImportKw: point.gridImportKw,
  };
};

const alertLevelWeight = {
  high: 3,
  medium: 2,
  info: 1,
} as const;

export const buildSystemAlerts = (
  data: DashboardScenarioData,
  live: LiveDashboardSnapshot,
  hourIndex: number,
): SystemAlert[] => {
  const alerts: SystemAlert[] = [];
  const point = data.hourly[hourIndex];
  const hour = Number.parseInt(point.hour.slice(0, 2), 10);
  const terms = getModeTerms(data.operationMode);
  const isTemperatureStress = data.operationMode === 'cooling'
    ? live.weather.ambientTempC >= 34
    : live.weather.ambientTempC <= 2;

  if (isTemperatureStress || data.scenario === 'heatwave') {
    alerts.push({
      id: `${data.operationMode}-${data.scenario}-temperature`,
      title: data.operationMode === 'cooling' ? '高温负荷预警' : '寒潮负荷预警',
      summary: `${data.operationMode === 'cooling' ? '高温' : '低温'}推升${terms.demand}负荷，建议维持提前${terms.charge}与分区调节策略。`,
      level: 'high',
      nodeId: 'ac',
      metric: '室外温度',
      value: `${live.weather.ambientTempC.toFixed(1)}℃`,
      suggestion: `优先保障图书馆与实验楼，并按${terms.available}安排${terms.discharge}。`,
    });
  }

  if (data.scenario === 'cloudy' || live.photovoltaic.powerKw < 160) {
    alerts.push({
      id: `${data.operationMode}-${data.scenario}-pv-drop`,
      title: data.scenario === 'cloudy' && hour >= 13 && hour <= 16
        ? '云层遮挡导致光伏骤降'
        : '光伏出力偏低',
      summary: `当前光伏不足，系统通过${terms.discharge}降低${terms.plant}用电，并由电网补足剩余电力缺口。`,
      level: data.scenario === 'cloudy' ? 'high' : 'medium',
      nodeId: 'pv',
      metric: '光伏功率',
      value: `${live.photovoltaic.powerKw.toFixed(1)} kW`,
      suggestion: `维持核心负荷优先级，并保留晚高峰所需${terms.available}。`,
    });
  }

  if (live.gridImportKw >= 150 || data.scenario === 'peakPricing') {
    alerts.push({
      id: `${data.operationMode}-${data.scenario}-grid`,
      title: '购电成本敏感',
      summary: `高价时段网侧购电抬升，需要用${terms.discharge}降低${terms.plant}电功率。`,
      level: data.scenario === 'peakPricing' ? 'high' : 'medium',
      nodeId: 'grid',
      metric: '网购电功率',
      value: `${live.gridImportKw.toFixed(1)} kW`,
      suggestion: `根据水罐储能率提升${terms.discharge}优先级，避免形成新的购电峰值。`,
    });
  }

  if (live.storage.storageLevelPct <= 35 || live.storage.dischargePowerKwTh >= 120) {
    alerts.push({
      id: `${data.operationMode}-${data.scenario}-storage`,
      title: '水罐储能策略关注',
      summary: `分层水罐进入高强度参与区间，需要平衡削峰收益与${terms.available}安全余量。`,
      level: live.storage.storageLevelPct <= 35 ? 'high' : 'medium',
      nodeId: 'storage',
      metric: `储能率 / ${terms.discharge}功率`,
      value: `${live.storage.storageLevelPct.toFixed(1)}% / ${live.storage.dischargePowerKwTh.toFixed(1)} kWth`,
      suggestion: `保留必要${terms.available}，下一谷价窗口再从电网${terms.charge}。`,
    });
  }

  if (hour >= 10 && hour <= 15 && live.photovoltaic.powerKw >= 280) {
    alerts.push({
      id: `${data.operationMode}-${data.scenario}-pv-window`,
      title: '绿电消纳窗口',
      summary: `当前光伏先覆盖园区电负荷，真实富余电力可驱动${terms.plant}${terms.charge}。`,
      level: 'info',
      nodeId: 'pv',
      metric: '辐照强度',
      value: `${live.photovoltaic.irradianceWm2} W/m²`,
      suggestion: `保持水罐剩余空间，为晚峰段${terms.discharge}预留能力。`,
    });
  }

  return alerts
    .sort((left, right) => alertLevelWeight[right.level] - alertLevelWeight[left.level])
    .slice(0, 4);
};

export const buildPresentationScript = (): PresentationChapter[] => [
  {
    id: 'chapter-01',
    title: '开场总览：智慧校园双碳底座',
    summary: '从园区总览切入，展示光伏、冷站、蓄冷水罐与电网的协同关系。',
    scenario: 'normal',
    operationMode: 'cooling',
    focus: 'overview',
    nodeId: 'pv',
    hourIndex: 10,
    durationMs: 7000,
    highlight: '一张大屏同时呈现电力流、冷热流、设备状态与经营价值。',
    benefit: '绿电优先覆盖园区电负荷，水系统负责跨时段转移冷量。',
  },
  {
    id: 'chapter-02',
    title: '中午消纳：光伏直供并富余充冷',
    summary: '强调光伏先覆盖实时电负荷，真实富余电力再驱动冷站向水罐充冷。',
    scenario: 'normal',
    operationMode: 'cooling',
    focus: 'pv',
    nodeId: 'pv',
    hourIndex: 13,
    durationMs: 7600,
    highlight: '电力与冷量分开计量，能够清楚解释绿电如何转化为可用冷量。',
    benefit: '提高光伏自用率，并为晚高峰准备可用冷量。',
  },
  {
    id: 'chapter-03',
    title: '高温挑战：AI 充冷放冷保舒适',
    summary: '切换高温模式，展示供冷负荷攀升时，AI 如何调度冷站、蓄冷水罐与楼栋末端。',
    scenario: 'heatwave',
    operationMode: 'cooling',
    focus: 'ac',
    nodeId: 'ac',
    hourIndex: 15,
    durationMs: 8200,
    highlight: '水罐放冷直接分担热负荷，冷站电耗按 COP 同步下降。',
    benefit: '峰值电功率下降，同时维持关键区域舒适度。',
  },
  {
    id: 'chapter-04',
    title: '云层遮挡：放冷降低冷站电耗',
    summary: '切换云层遮挡模式，展示光伏骤降时水罐放冷、电网补足电力缺口的协同逻辑。',
    scenario: 'cloudy',
    operationMode: 'cooling',
    focus: 'storage',
    nodeId: 'storage',
    hourIndex: 14,
    durationMs: 7600,
    highlight: '冷量不被误算成发电，而是通过减少冷站产冷量来降低电负荷。',
    benefit: '关键楼宇持续供冷，购电峰值受到抑制。',
  },
  {
    id: 'chapter-05',
    title: '峰价收益：水罐放冷削峰',
    summary: '切换高峰电价模式，展示系统如何调用可用冷量减少高价时段冷站用电。',
    scenario: 'peakPricing',
    operationMode: 'cooling',
    focus: 'storage',
    nodeId: 'grid',
    hourIndex: 19,
    durationMs: 8400,
    highlight: '削峰率以无蓄能基线冷站电功率为参照，收益口径清晰。',
    benefit: '减少峰价购电，并将舒适度变化控制在可接受范围内。',
  },
  {
    id: 'chapter-06',
    title: '冬季扩展：寒潮下的蓄热调度',
    summary: '以寒潮供热场景收束，展示同一水系统模型如何切换为充热与放热运行。',
    scenario: 'heatwave',
    operationMode: 'heating',
    focus: 'overview',
    nodeId: 'storage',
    hourIndex: 18,
    durationMs: 7000,
    highlight: '供冷与供热共用清晰的热量平衡、储能率和水罐边界。',
    benefit: '平台可覆盖校园全年冷热源优化与碳资产运营。',
  },
];

export const buildRuntimeMeta = (dataSource: DataSourceMode = 'mock'): DashboardRuntimeMeta => ({
  dataSource,
  providerLabel: dataSource === 'api' ? 'Campus Energy API' : 'Mock Twin Engine',
  lastUpdated: new Date().toISOString(),
  refreshIntervalSec: 5,
});
