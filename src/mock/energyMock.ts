import type {
  DashboardRuntimeMeta,
  DataSourceMode,
  AiDecisionOutput,
  AirConditionMetrics,
  AirConditionStatus,
  DashboardScenarioData,
  EconomicMetrics,
  FocusView,
  EnergyMixItem,
  HourlyPoint,
  LiveDashboardSnapshot,
  PresentationChapter,
  ScenarioMode,
  StorageMetrics,
  StorageState,
  SystemAlert,
  SystemNodeStatus,
  WeatherSnapshot,
  WeeklyStat,
} from '@/types/energy';
import { clamp } from '@/utils/format';

const scenarioMeta: Record<
  ScenarioMode,
  {
    label: string;
    summary: string;
    pvFactor: number;
    loadFactor: number;
    priceFactor: number;
    cloud: number;
    ambientBias: number;
    storageBias: number;
  }
> = {
  normal: {
    label: '正常模式',
    summary: '光伏、空调与储能按常规工况协同运行，优先保障舒适度与基础节能收益。',
    pvFactor: 1,
    loadFactor: 1,
    priceFactor: 1,
    cloud: 0.2,
    ambientBias: 0,
    storageBias: 0,
  },
  heatwave: {
    label: '高温模式',
    summary: '午后高温导致空调负荷上升，AI 提前预冷并引导储能削峰，保障楼宇舒适与电费控制。',
    pvFactor: 1.08,
    loadFactor: 1.24,
    priceFactor: 1.05,
    cloud: 0.16,
    ambientBias: 6,
    storageBias: 0.15,
  },
  cloudy: {
    label: '阴天模式',
    summary: '光照不足降低光伏输出，系统通过储能与电网联合托底，维持核心区域空调稳定运行。',
    pvFactor: 0.58,
    loadFactor: 0.96,
    priceFactor: 1,
    cloud: 0.72,
    ambientBias: -2,
    storageBias: -0.08,
  },
  peakPricing: {
    label: '高峰电价模式',
    summary: '分时电价高峰区段强化储能放电，尽量减少高价购电，放大 AI 调度的经济性价值。',
    pvFactor: 0.96,
    loadFactor: 1.04,
    priceFactor: 1.36,
    cloud: 0.28,
    ambientBias: 1,
    storageBias: 0.28,
  },
};

const peakHours = new Set([10, 11, 14, 15, 16, 18, 19, 20]);

const getPrice = (hour: number, factor: number) => {
  if (hour <= 6) return 0.42 * factor;
  if (hour <= 9) return 0.68 * factor;
  if (hour <= 16) return 0.92 * factor;
  if (hour <= 21) return 1.15 * factor;
  return 0.61 * factor;
};

const getStatusByLoad = (loadKw: number): AirConditionStatus => {
  if (loadKw >= 350) return '制冷增强';
  if (loadKw >= 260) return '常规制冷';
  if (loadKw >= 160) return '节能模式';
  return '待机巡检';
};

const getStorageState = (chargeKw: number, dischargeKw: number): StorageState => {
  if (chargeKw > dischargeKw && chargeKw > 12) return '充电中';
  if (dischargeKw > chargeKw && dischargeKw > 12) return '放电中';
  return '待机均衡';
};

const hourLabel = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

export const buildHourlySeries = (scenario: ScenarioMode): HourlyPoint[] => {
  const meta = scenarioMeta[scenario];

  return Array.from({ length: 24 }, (_, hour) => {
    const solarCurve = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const pv = Math.round((solarCurve ** 1.5) * 620 * meta.pvFactor);
    const occupancyCurve = hour >= 7 && hour <= 21 ? 0.72 + Math.sin(((hour - 7) / 14) * Math.PI) * 0.24 : 0.32;
    const coolingCurve = hour >= 11 && hour <= 18 ? 1 + Math.sin(((hour - 11) / 7) * Math.PI) * 0.32 : 0.78;
    const load = Math.round((145 + occupancyCurve * 120 + coolingCurve * 90 + meta.ambientBias * 4) * meta.loadFactor);
    const price = Number(getPrice(hour, meta.priceFactor).toFixed(2));
    const strategicDischarge = peakHours.has(hour) ? 42 + meta.storageBias * 48 : 18 + meta.storageBias * 12;
    const storageChargeKw = pv > load ? Math.round((pv - load) * 0.45) : hour <= 6 ? 28 : 8;
    const storageDischargeKw = pv < load ? Math.round(Math.min(load - pv, strategicDischarge)) : hour >= 18 ? 36 : 12;
    const gridImportKw = Math.max(0, Math.round(load + storageChargeKw - pv - storageDischargeKw));
    const carbonReductionKg = Number((pv * 0.62 + storageDischargeKw * 0.18).toFixed(1));
    const savingCny = Number(((pv * 0.42 + storageDischargeKw * price * 0.55) / 1.6).toFixed(1));
    const irradianceWm2 = Math.round(920 * solarCurve * meta.pvFactor);
    const ambientTempC = Number(
      (23 + Math.sin(((hour - 7) / 12) * Math.PI) * 8 + meta.ambientBias + (scenario === 'heatwave' ? 2.4 : 0)).toFixed(1),
    );

    return {
      hour: hourLabel(hour),
      photovoltaicKw: pv,
      loadKw: load,
      storageChargeKw,
      storageDischargeKw,
      gridImportKw,
      carbonReductionKg,
      savingCny,
      priceCny: price,
      irradianceWm2,
      ambientTempC,
    };
  });
};

const buildWeeklyStats = (scenario: ScenarioMode, hourly: HourlyPoint[]): WeeklyStat[] => {
  const basePv = hourly.reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const baseLoad = hourly.reduce((sum, item) => sum + item.loadKw, 0);
  const meta = scenarioMeta[scenario];

  return Array.from({ length: 7 }, (_, index) => {
    const dayFactor = 0.92 + index * 0.03;
    return {
      date: `04-${(11 + index).toString().padStart(2, '0')}`,
      pvGenerationKwh: Math.round(basePv * dayFactor * 0.85),
      loadConsumptionKwh: Math.round(baseLoad * (0.86 + index * 0.02)),
      savingRatePct: Number((19.4 * meta.pvFactor + index * 0.4 + meta.storageBias * 10).toFixed(1)),
      carbonReductionKg: Math.round(basePv * 0.45 * dayFactor),
      benefitCny: Math.round(basePv * 0.36 * dayFactor * meta.priceFactor),
    };
  });
};

const buildAiDecision = (scenario: ScenarioMode, hourly: HourlyPoint[]): AiDecisionOutput => {
  if (scenario === 'heatwave') {
    return {
      title: 'AI 高温削峰联动策略',
      status: '增强调度中',
      confidencePct: 94,
      summary: '预测 14:00-18:00 高温高负荷窗口，优先消纳光伏并在 17:00 后启用储能削峰。',
      recommendation: '建议图书馆与实验楼设定温度上调 1℃，结合分区控制降低不必要冷量输出。',
      expectedBenefitCny: 1880,
      expectedCarbonKg: 362,
      strategyRules: [
        {
          id: 'heat-1',
          title: '午前预冷蓄能',
          score: 92,
          description: '利用 10:00-13:00 的高光伏出力为楼宇预冷，并同时提升电池 SOC。',
          expectedSavingPct: 14.8,
          expectedBenefitCny: 560,
          flow: 'charge',
        },
        {
          id: 'heat-2',
          title: '傍晚储能削峰',
          score: 95,
          description: '在 17:00-20:00 电价高位窗口优先放电，减少峰时购电。',
          expectedSavingPct: 18.4,
          expectedBenefitCny: 830,
          flow: 'discharge',
        },
        {
          id: 'heat-3',
          title: '舒适度约束优化',
          score: 86,
          description: '在舒适度不低于 84% 的前提下，动态下调低人流区送风功率。',
          expectedSavingPct: 8.6,
          expectedBenefitCny: 490,
          flow: 'directSupply',
        },
      ],
      timeline: [
        { time: '09:00', title: '光伏预测上修', level: 'info', summary: '上午辐照优于昨日均值 7.2%', benefit: '+PV 消纳 9%' },
        { time: '11:30', title: '预冷任务启动', level: 'medium', summary: '教学楼北区开始提前预冷，减轻午后峰值负荷。', benefit: '削峰 31kW' },
        { time: '17:10', title: '储能放电接管', level: 'high', summary: '峰段价格触发放电策略，优先保障实验楼与机房。', benefit: '节费 ¥830' },
      ],
    };
  }

  if (scenario === 'cloudy') {
    return {
      title: 'AI 阴天稳态托底策略',
      status: '稳态调度中',
      confidencePct: 89,
      summary: '光照不足导致 PV 降额运行，AI 自动切换储能与电网协同托底，保障关键区域舒适度。',
      recommendation: '建议将非满载楼层切换节能模式，并保留 25% 储能余量应对晚高峰。',
      expectedBenefitCny: 1180,
      expectedCarbonKg: 208,
      strategyRules: [
        {
          id: 'cloud-1',
          title: '储能兜底供冷',
          score: 88,
          description: '优先保障图书馆与实验楼空调，普通教学楼切换节能风量。',
          expectedSavingPct: 9.4,
          expectedBenefitCny: 360,
          flow: 'discharge',
        },
        {
          id: 'cloud-2',
          title: '分时购电优化',
          score: 84,
          description: '低价时段补充 SOC，在高价时段平滑电网侧功率波动。',
          expectedSavingPct: 7.1,
          expectedBenefitCny: 420,
          flow: 'gridSupport',
        },
        {
          id: 'cloud-3',
          title: '负荷柔性调节',
          score: 81,
          description: '根据人流热力图适度下调低占用区域的送风功率。',
          expectedSavingPct: 6.3,
          expectedBenefitCny: 400,
          flow: 'directSupply',
        },
      ],
      timeline: [
        { time: '08:20', title: '云层遮挡预警', level: 'info', summary: '天气模型下调全天辐照预测，触发保守策略。', benefit: '保留 SOC 25%' },
        { time: '14:00', title: '舒适优先供能', level: 'medium', summary: '图书馆与实验室供冷优先级提高。', benefit: '舒适度 88%' },
        { time: '19:00', title: '削峰购电执行', level: 'high', summary: '避开峰价时段 21% 购电量。', benefit: '节费 ¥420' },
      ],
    };
  }

  if (scenario === 'peakPricing') {
    return {
      title: 'AI 峰谷套利强化策略',
      status: '收益优先',
      confidencePct: 96,
      summary: '基于分时电价强化储能套利，尽量在高峰窗口减少网购电并压降需量。',
      recommendation: '维持白天 82% 以上 SOC，并在 18:00-21:00 主动释放储能优先保障空调高优先级区域。',
      expectedBenefitCny: 2260,
      expectedCarbonKg: 335,
      strategyRules: [
        {
          id: 'peak-1',
          title: '午间充电蓄势',
          score: 91,
          description: '利用光伏富余时段叠加谷价补电，锁定晚高峰放电空间。',
          expectedSavingPct: 12.7,
          expectedBenefitCny: 650,
          flow: 'charge',
        },
        {
          id: 'peak-2',
          title: '高峰削峰放电',
          score: 98,
          description: '在 18:00-21:00 释放储能，显著减少高价购电。',
          expectedSavingPct: 21.3,
          expectedBenefitCny: 980,
          flow: 'discharge',
        },
        {
          id: 'peak-3',
          title: '需量阈值管控',
          score: 89,
          description: '限制总功率峰值，避免触发更高容量电费档位。',
          expectedSavingPct: 10.2,
          expectedBenefitCny: 630,
          flow: 'gridSupport',
        },
      ],
      timeline: [
        { time: '10:40', title: 'SOC 拉升完成', level: 'info', summary: '储能 SOC 达到峰前目标值 86%。', benefit: '晚高峰准备完成' },
        { time: '18:00', title: '峰价防线启动', level: 'high', summary: '储能开始接管 34% 冷站负荷。', benefit: '削峰 68kW' },
        { time: '20:30', title: '套利收益结算', level: 'medium', summary: '本轮峰谷优化收益显著。', benefit: '节费 ¥980' },
      ],
    };
  }

  return {
    title: 'AI 常规协同优化策略',
    status: '平稳运行',
    confidencePct: 93,
    summary: '系统按光伏优先、储能跟随、电网托底的规则运行，兼顾舒适度与节能收益。',
    recommendation: '保持教学楼分区送风策略，并在中午富余光伏时优先补充储能。',
    expectedBenefitCny: 1560,
    expectedCarbonKg: 318,
    strategyRules: [
      {
        id: 'normal-1',
        title: '光伏直供空调',
        score: 95,
        description: '中午高辐照时段优先由光伏直接覆盖空调基础负荷。',
        expectedSavingPct: 15.2,
        expectedBenefitCny: 520,
        flow: 'directSupply',
      },
      {
        id: 'normal-2',
        title: '富余电量充储',
        score: 88,
        description: '富余光伏自动转入储能，为晚高峰削峰做准备。',
        expectedSavingPct: 9.8,
        expectedBenefitCny: 430,
        flow: 'charge',
      },
      {
        id: 'normal-3',
        title: '峰时储能补能',
        score: 90,
        description: '当电价抬升且 PV 下降时，由电池补偿空调侧负荷。',
        expectedSavingPct: 11.4,
        expectedBenefitCny: 610,
        flow: 'discharge',
      },
    ],
    timeline: [
      { time: '09:30', title: '光伏并网稳定', level: 'info', summary: '晨间发电曲线进入上升通道。', benefit: '绿电占比 42%' },
      { time: '12:50', title: '储能充电完成', level: 'medium', summary: '富余光伏被引导至电池柜。', benefit: 'SOC +18%' },
      { time: '18:20', title: '晚高峰削峰', level: 'high', summary: '储能承担主要削峰任务，电网功率回落。', benefit: '节费 ¥610' },
    ],
  };
};

const buildEnergyMix = (hourly: HourlyPoint[]): EnergyMixItem[] => {
  const pv = hourly.reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const storage = hourly.reduce((sum, item) => sum + item.storageDischargeKw, 0);
  const grid = hourly.reduce((sum, item) => sum + item.gridImportKw, 0);

  return [
    { name: '光伏直供', value: Number(((pv / (pv + storage + grid)) * 100).toFixed(1)), color: '#15f5ba' },
    { name: '储能调节', value: Number(((storage / (pv + storage + grid)) * 100).toFixed(1)), color: '#46b3ff' },
    { name: '电网补给', value: Number(((grid / (pv + storage + grid)) * 100).toFixed(1)), color: '#ffd66b' },
  ];
};

const buildNodes = (scenario: ScenarioMode, hourly: HourlyPoint[]): SystemNodeStatus[] => {
  const live = hourly[14];
  const meta = scenarioMeta[scenario];

  return [
    {
      id: 'pv',
      label: '屋顶光伏阵列',
      type: 'pv',
      powerKw: live.photovoltaicKw,
      state: live.photovoltaicKw > 280 ? '高效发电' : '波动发电',
      efficiencyPct: clamp(84 + meta.pvFactor * 10, 76, 97),
      detail: '双层屋顶光伏矩阵，支持辐照联动动态功率演示。',
    },
    {
      id: 'building-a',
      label: '教学楼 A',
      type: 'building',
      powerKw: Math.round(live.loadKw * 0.36),
      state: '教学运行',
      efficiencyPct: 88,
      detail: '主教学楼，白天人流高峰明显，空调负荷受课表与温度共同影响。',
    },
    {
      id: 'building-b',
      label: '图书馆',
      type: 'building',
      powerKw: Math.round(live.loadKw * 0.27),
      state: '阅读高峰',
      efficiencyPct: 90,
      detail: '图书馆对舒适度更敏感，AI 会优先保障阅览区温度稳定。',
    },
    {
      id: 'building-c',
      label: '实验楼',
      type: 'building',
      powerKw: Math.round(live.loadKw * 0.22),
      state: '实验运行',
      efficiencyPct: 87,
      detail: '实验楼负荷波动较大，是储能削峰的重点保障对象。',
    },
    {
      id: 'ac',
      label: '空调冷站',
      type: 'ac',
      powerKw: live.loadKw,
      state: getStatusByLoad(live.loadKw),
      efficiencyPct: clamp(78 + (1 - meta.loadFactor) * 10 + meta.storageBias * 6, 71, 92),
      detail: '集中冷站联动各楼栋末端设备，支持分区控温与舒适度约束。',
    },
    {
      id: 'storage',
      label: '储能电池柜',
      type: 'storage',
      powerKw: live.storageDischargeKw || live.storageChargeKw,
      state: live.storageDischargeKw > live.storageChargeKw ? '削峰放电' : '柔性充电',
      efficiencyPct: clamp(91 + meta.storageBias * 10, 85, 98),
      detail: '支持峰谷套利与柔性调节，是 AI 调度的重要执行节点。',
    },
    {
      id: 'grid',
      label: '园区电网接口',
      type: 'grid',
      powerKw: live.gridImportKw,
      state: live.gridImportKw > 120 ? '托底供能' : '低负载接入',
      efficiencyPct: 100,
      detail: '接入园区配电网，用于兜底供电与需量侧优化展示。',
    },
  ];
};

export const buildScenarioData = (scenario: ScenarioMode): DashboardScenarioData => {
  const meta = scenarioMeta[scenario];
  const hourly = buildHourlySeries(scenario);
  const weekly = buildWeeklyStats(scenario, hourly);
  const live = hourly[14];
  const pvDay = hourly.reduce((sum, item) => sum + item.photovoltaicKw, 0) * 0.72;
  const savingTotal = hourly.reduce((sum, item) => sum + item.savingCny, 0);
  const carbonTotal = hourly.reduce((sum, item) => sum + item.carbonReductionKg, 0);
  const storageSoc = clamp(56 + meta.pvFactor * 16 + meta.storageBias * 28, 38, 92);
  const storageCharge = live.photovoltaicKw > live.loadKw ? live.storageChargeKw : 18;
  const storageDischarge = peakHours.has(14) || peakHours.has(19) ? live.storageDischargeKw : 22;

  const weather: WeatherSnapshot = {
    weatherText: scenario === 'cloudy' ? '多云偏阴' : scenario === 'heatwave' ? '晴热高温' : '晴间多云',
    irradianceWm2: live.irradianceWm2,
    ambientTempC: live.ambientTempC,
    indoorTempC: Number((24.6 + (scenario === 'heatwave' ? 0.8 : 0) - (scenario === 'cloudy' ? 0.3 : 0)).toFixed(1)),
    humidityPct: clamp(48 + meta.cloud * 18, 38, 76),
    windSpeedMs: Number((2.8 + meta.cloud * 2.6).toFixed(1)),
    lightLevelPct: clamp(92 * meta.pvFactor, 48, 96),
    comfortIndex: clamp(88 - meta.ambientBias * 1.2 + meta.storageBias * 3, 72, 94),
    cloudCoverPct: Math.round(meta.cloud * 100),
  };

  const airConditioning: AirConditionMetrics = {
    totalLoadKw: live.loadKw,
    outdoorTempC: live.ambientTempC,
    indoorAvgTempC: weather.indoorTempC,
    humidityPct: weather.humidityPct,
    comfortPct: weather.comfortIndex,
    runningStatus: getStatusByLoad(live.loadKw),
    zones: [
      {
        id: 'z1',
        name: '教学楼 A',
        loadKw: Math.round(live.loadKw * 0.34),
        status: getStatusByLoad(live.loadKw * 0.34),
        indoorTempC: Number((weather.indoorTempC + 0.3).toFixed(1)),
        targetTempC: scenario === 'heatwave' ? 25.5 : 25,
        humidityPct: clamp(weather.humidityPct + 3, 42, 75),
        comfortPct: clamp(weather.comfortIndex - 2, 70, 95),
        occupancyPct: 82,
      },
      {
        id: 'z2',
        name: '图书馆',
        loadKw: Math.round(live.loadKw * 0.27),
        status: '常规制冷',
        indoorTempC: Number((weather.indoorTempC - 0.2).toFixed(1)),
        targetTempC: 24.5,
        humidityPct: clamp(weather.humidityPct, 40, 72),
        comfortPct: clamp(weather.comfortIndex + 3, 78, 96),
        occupancyPct: 74,
      },
      {
        id: 'z3',
        name: '实验楼',
        loadKw: Math.round(live.loadKw * 0.22),
        status: scenario === 'cloudy' ? '节能模式' : '常规制冷',
        indoorTempC: Number((weather.indoorTempC + 0.1).toFixed(1)),
        targetTempC: 24.8,
        humidityPct: clamp(weather.humidityPct - 2, 38, 70),
        comfortPct: clamp(weather.comfortIndex, 74, 94),
        occupancyPct: 68,
      },
      {
        id: 'z4',
        name: '行政楼',
        loadKw: Math.round(live.loadKw * 0.17),
        status: scenario === 'cloudy' ? '待机巡检' : '节能模式',
        indoorTempC: Number((weather.indoorTempC + 0.4).toFixed(1)),
        targetTempC: 25.8,
        humidityPct: clamp(weather.humidityPct + 1, 41, 73),
        comfortPct: clamp(weather.comfortIndex - 4, 68, 90),
        occupancyPct: 51,
      },
    ],
  };

  const storage: StorageMetrics = {
    capacityKwh: 980,
    socPct: Number(storageSoc.toFixed(1)),
    chargePowerKw: storageCharge,
    dischargePowerKw: storageDischarge,
    state: getStorageState(storageCharge, storageDischarge),
    healthPct: 96.2,
    cycleCount: 324,
  };

  const economics: EconomicMetrics = {
    dailySavingCny: Math.round(savingTotal),
    monthlySavingCny: Math.round(savingTotal * 29.4),
    peakValleyBenefitCny: Math.round(savingTotal * (0.38 + meta.storageBias)),
    roiTrendPct: Number((12.6 + meta.priceFactor * 2.3 + meta.storageBias * 10).toFixed(1)),
    annualForecastCny: Math.round(savingTotal * 365 * 0.84),
  };

  return {
    scenario,
    scenarioLabel: meta.label,
    scenarioSummary: meta.summary,
    coreKpi: {
      totalPowerKw: live.loadKw + storageCharge,
      savingRatePct: Number((18.6 + meta.pvFactor * 4 + meta.storageBias * 11 - meta.cloud * 4).toFixed(1)),
      carbonReductionKg: Math.round(carbonTotal),
      economicGainCny: economics.dailySavingCny,
      greenEnergyRatioPct: Number((buildEnergyMix(hourly)[0].value + buildEnergyMix(hourly)[1].value).toFixed(1)),
    },
    weather,
    photovoltaic: {
      powerKw: live.photovoltaicKw,
      todayGenerationKwh: Math.round(pvDay),
      efficiencyPct: Number((84.5 + meta.pvFactor * 7 - meta.cloud * 8).toFixed(1)),
      irradianceWm2: live.irradianceWm2,
      panelTempC: Number((41 + meta.ambientBias * 0.8 + meta.pvFactor * 5).toFixed(1)),
      fluctuationPct: Number((4.8 + meta.cloud * 6.4).toFixed(1)),
    },
    airConditioning,
    storage,
    environment: {
      carbonReductionKg: Math.round(carbonTotal),
      treeEquivalent: Math.round(carbonTotal / 18),
      renewableRatioPct: Number((buildEnergyMix(hourly)[0].value + buildEnergyMix(hourly)[1].value).toFixed(1)),
      pm25: Math.round(17 + meta.cloud * 15),
      ambientTempC: weather.ambientTempC,
      lightLevelPct: weather.lightLevelPct,
    },
    economics,
    energyMix: buildEnergyMix(hourly),
    hourly,
    weekly,
    ai: buildAiDecision(scenario, hourly),
    nodes: buildNodes(scenario, hourly),
  };
};

export const deriveLiveSnapshot = (data: DashboardScenarioData, hourIndex: number): LiveDashboardSnapshot => {
  const point = data.hourly[hourIndex];
  const pvProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.photovoltaicKw, 0);
  const savingProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.savingCny, 0);
  const carbonProgress = data.hourly
    .slice(0, hourIndex + 1)
    .reduce((sum, item) => sum + item.carbonReductionKg, 0);
  const storageSoc = clamp(data.storage.socPct + point.storageChargeKw * 0.04 - point.storageDischargeKw * 0.06, 24, 96);
  const comfort = clamp(data.weather.comfortIndex - (point.loadKw > 320 ? 2.2 : 0) + (point.photovoltaicKw > 280 ? 1.2 : 0), 72, 96);

  return {
    hourLabel: point.hour,
    coreKpi: {
      totalPowerKw: point.loadKw + point.storageChargeKw,
      savingRatePct: Number((data.coreKpi.savingRatePct + (point.photovoltaicKw > 300 ? 1.2 : -0.6)).toFixed(1)),
      carbonReductionKg: Math.round(carbonProgress),
      economicGainCny: Math.round(savingProgress),
      greenEnergyRatioPct: Number((clamp((point.photovoltaicKw + point.storageDischargeKw) / Math.max(point.loadKw, 1) * 100, 38, 98)).toFixed(1)),
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
      todayGenerationKwh: Math.round(pvProgress * 0.72),
      fluctuationPct: Number((data.photovoltaic.fluctuationPct + Math.abs(point.photovoltaicKw - data.photovoltaic.powerKw) * 0.01).toFixed(1)),
    },
    airConditioning: {
      ...data.airConditioning,
      totalLoadKw: point.loadKw,
      outdoorTempC: point.ambientTempC,
      comfortPct: Number(comfort.toFixed(1)),
      runningStatus: getStatusByLoad(point.loadKw),
      zones: data.airConditioning.zones.map((zone, index) => ({
        ...zone,
        loadKw: Math.round(point.loadKw * [0.34, 0.27, 0.22, 0.17][index]),
        comfortPct: clamp(zone.comfortPct + (index === 1 ? 2 : -1) + (point.photovoltaicKw > 300 ? 2 : 0), 68, 96),
      })),
    },
    storage: {
      ...data.storage,
      socPct: Number(storageSoc.toFixed(1)),
      chargePowerKw: point.storageChargeKw,
      dischargePowerKw: point.storageDischargeKw,
      state: getStorageState(point.storageChargeKw, point.storageDischargeKw),
    },
    environment: {
      ...data.environment,
      carbonReductionKg: Math.round(carbonProgress),
      treeEquivalent: Math.round(carbonProgress / 18),
      ambientTempC: point.ambientTempC,
      lightLevelPct: clamp((point.irradianceWm2 / 9.8), 12, 100),
    },
    economics: {
      ...data.economics,
      dailySavingCny: Math.round(savingProgress),
      peakValleyBenefitCny: Math.round(data.economics.peakValleyBenefitCny * (0.78 + point.priceCny / 2)),
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
  const hour = Number.parseInt(data.hourly[hourIndex].hour.slice(0, 2), 10);

  if (live.weather.ambientTempC >= 34 || data.scenario === 'heatwave') {
    alerts.push({
      id: `${data.scenario}-high-temp`,
      title: '高温负荷预警',
      summary: '午后高温推升冷站负荷，建议维持预冷与分区控温策略。',
      level: 'high',
      nodeId: 'ac',
      metric: '室外温度',
      value: `${live.weather.ambientTempC.toFixed(1)}℃`,
      suggestion: '优先保障图书馆与实验楼，普通楼层提升设定点 0.5~1℃。',
    });
  }

  if (data.scenario === 'cloudy' || live.photovoltaic.powerKw < 160) {
    alerts.push({
      id: `${data.scenario}-pv-drop`,
      title: '光伏出力偏低',
      summary: '当前辐照不足，系统需提升储能与电网协同供能能力。',
      level: data.scenario === 'cloudy' ? 'high' : 'medium',
      nodeId: 'pv',
      metric: '光伏功率',
      value: `${live.photovoltaic.powerKw} kW`,
      suggestion: '维持核心负荷优先级，并保留晚高峰可用 SOC。',
    });
  }

  if (live.gridImportKw >= 150 || data.scenario === 'peakPricing') {
    alerts.push({
      id: `${data.scenario}-grid`,
      title: '购电成本敏感',
      summary: '高价时段网侧购电占比抬升，需强化储能削峰与需量控制。',
      level: data.scenario === 'peakPricing' ? 'high' : 'medium',
      nodeId: 'grid',
      metric: '网购电功率',
      value: `${live.gridImportKw} kW`,
      suggestion: '提升储能放电优先级，避免 18:00-21:00 形成新的功率峰值。',
    });
  }

  if (live.storage.socPct <= 42 || live.storage.dischargePowerKw >= 42) {
    alerts.push({
      id: `${data.scenario}-storage`,
      title: '储能策略关注',
      summary: '储能进入高强度参与区间，需要平衡削峰收益与余量安全。',
      level: live.storage.socPct <= 42 ? 'high' : 'medium',
      nodeId: 'storage',
      metric: 'SOC / 放电功率',
      value: `${live.storage.socPct.toFixed(1)}% / ${live.storage.dischargePowerKw} kW`,
      suggestion: '保留 25% 以上安全裕量，必要时引入低价补电。',
    });
  }

  if (hour >= 10 && hour <= 15 && live.photovoltaic.powerKw >= 280) {
    alerts.push({
      id: `${data.scenario}-pv-window`,
      title: '绿电消纳窗口',
      summary: '当前是高光照窗口，适合优先空调直供并同步补能储电。',
      level: 'info',
      nodeId: 'pv',
      metric: '辐照强度',
      value: `${live.photovoltaic.irradianceWm2} W/m²`,
      suggestion: '将富余光伏电量优先转入储能，为晚峰段预留削峰能力。',
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
    summary: '从园区总览切入，展示光伏、空调、储能与电网的协同关系，建立项目全局认知。',
    scenario: 'normal',
    focus: 'overview',
    nodeId: 'pv',
    hourIndex: 10,
    durationMs: 7000,
    highlight: '一张大屏同时呈现能源流、设备态和经营价值，适合比赛答辩开场。',
    benefit: '当前绿电占比稳定提升，系统综合节能进入常态优化区间。',
  },
  {
    id: 'chapter-02',
    title: '中午消纳：光伏直供空调并富余充储',
    summary: '切换到光伏视角，强调高辐照窗口下的光伏直供与富余电量充储逻辑。',
    scenario: 'normal',
    focus: 'pv',
    nodeId: 'pv',
    hourIndex: 13,
    durationMs: 7600,
    highlight: '中午绿电优先覆盖空调基础负荷，剩余电量自动进入储能电池柜。',
    benefit: '系统在不牺牲舒适度的前提下，提高了绿电消纳率与晚高峰准备度。',
  },
  {
    id: 'chapter-03',
    title: '高温挑战：AI 预冷削峰保舒适',
    summary: '切换高温模式，展示室外高温导致空调负荷攀升时，AI 如何通过预冷和分区策略稳住舒适度。',
    scenario: 'heatwave',
    focus: 'ac',
    nodeId: 'ac',
    hourIndex: 15,
    durationMs: 8200,
    highlight: 'AI 在高温工况下主动调度冷站与楼栋负荷，不只是展示数据，而是展示决策过程。',
    benefit: '峰值负荷被提前摊平，舒适度维持在比赛展示可感知的高水位。',
  },
  {
    id: 'chapter-04',
    title: '阴天托底：储能兜底与柔性调节',
    summary: '切换阴天模式，突出光伏出力不足时储能与电网协同托底的韧性能力。',
    scenario: 'cloudy',
    focus: 'storage',
    nodeId: 'storage',
    hourIndex: 14,
    durationMs: 7600,
    highlight: '在极端天气下，系统不只是省电，更强调关键区域的能源韧性与供能连续性。',
    benefit: '图书馆与实验楼保持优先供能，展示校园能源调度的稳定性价值。',
  },
  {
    id: 'chapter-05',
    title: '峰价收益：储能削峰放大经济效益',
    summary: '切换高峰电价模式，展示储能削峰与分时电价套利带来的直接经济收益。',
    scenario: 'peakPricing',
    focus: 'storage',
    nodeId: 'grid',
    hourIndex: 19,
    durationMs: 8400,
    highlight: '将抽象的 AI 调度转化为可量化的节费收益与投资回报，便于答辩说服评委。',
    benefit: '峰价窗口显著减少高价购电，储能收益和总电费优化效果直观可见。',
  },
  {
    id: 'chapter-06',
    title: '总结收束：从单点优化到校园级平台',
    summary: '回到总览，强调项目可从单楼扩展到整个智慧校园，形成能源管理平台。',
    scenario: 'peakPricing',
    focus: 'overview',
    nodeId: 'grid',
    hourIndex: 20,
    durationMs: 7000,
    highlight: '当前原型已具备展示价值、逻辑完整度和扩展能力，可演示也可持续开发。',
    benefit: '项目具备向校园级能源管理、碳资产运营与综合调度平台延展的基础。',
  },
];

export const buildRuntimeMeta = (dataSource: DataSourceMode = 'mock'): DashboardRuntimeMeta => ({
  dataSource,
  providerLabel: dataSource === 'api' ? 'Campus Energy API' : 'Mock Twin Engine',
  lastUpdated: new Date().toISOString(),
  refreshIntervalSec: 5,
});
