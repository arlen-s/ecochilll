export type ScenarioMode = 'normal' | 'heatwave' | 'cloudy' | 'peakPricing';
export type FocusView = 'overview' | 'pv' | 'ac' | 'storage';
export type FlowDirection = 'charge' | 'discharge' | 'directSupply' | 'gridSupport';
export type AirConditionStatus = '制冷增强' | '常规制冷' | '节能模式' | '待机巡检';
export type StorageState = '充电中' | '放电中' | '待机均衡';
export type AlertLevel = 'high' | 'medium' | 'info';
export type DataSourceMode = 'mock' | 'api';

export interface CoreKpi {
  totalPowerKw: number;
  savingRatePct: number;
  carbonReductionKg: number;
  economicGainCny: number;
  greenEnergyRatioPct: number;
}

export interface WeatherSnapshot {
  weatherText: string;
  irradianceWm2: number;
  ambientTempC: number;
  indoorTempC: number;
  humidityPct: number;
  windSpeedMs: number;
  lightLevelPct: number;
  comfortIndex: number;
  cloudCoverPct: number;
}

export interface PhotovoltaicMetrics {
  powerKw: number;
  todayGenerationKwh: number;
  efficiencyPct: number;
  irradianceWm2: number;
  panelTempC: number;
  fluctuationPct: number;
}

export interface AirConditionZone {
  id: string;
  name: string;
  loadKw: number;
  status: AirConditionStatus;
  indoorTempC: number;
  targetTempC: number;
  humidityPct: number;
  comfortPct: number;
  occupancyPct: number;
}

export interface AirConditionMetrics {
  totalLoadKw: number;
  outdoorTempC: number;
  indoorAvgTempC: number;
  humidityPct: number;
  comfortPct: number;
  runningStatus: AirConditionStatus;
  zones: AirConditionZone[];
}

export interface StorageMetrics {
  capacityKwh: number;
  socPct: number;
  chargePowerKw: number;
  dischargePowerKw: number;
  state: StorageState;
  healthPct: number;
  cycleCount: number;
}

export interface EnvironmentImpact {
  carbonReductionKg: number;
  treeEquivalent: number;
  renewableRatioPct: number;
  pm25: number;
  ambientTempC: number;
  lightLevelPct: number;
}

export interface EconomicMetrics {
  dailySavingCny: number;
  monthlySavingCny: number;
  peakValleyBenefitCny: number;
  roiTrendPct: number;
  annualForecastCny: number;
}

export interface EnergyMixItem {
  name: string;
  value: number;
  color: string;
}

export interface HourlyPoint {
  hour: string;
  photovoltaicKw: number;
  loadKw: number;
  storageChargeKw: number;
  storageDischargeKw: number;
  gridImportKw: number;
  carbonReductionKg: number;
  savingCny: number;
  priceCny: number;
  irradianceWm2: number;
  ambientTempC: number;
}

export interface WeeklyStat {
  date: string;
  pvGenerationKwh: number;
  loadConsumptionKwh: number;
  savingRatePct: number;
  carbonReductionKg: number;
  benefitCny: number;
}

export interface AiDispatchRule {
  id: string;
  title: string;
  score: number;
  description: string;
  expectedSavingPct: number;
  expectedBenefitCny: number;
  flow: FlowDirection;
}

export interface AiTimelineRecord {
  time: string;
  title: string;
  level: 'high' | 'medium' | 'info';
  summary: string;
  benefit: string;
}

export interface AiDecisionOutput {
  title: string;
  status: string;
  confidencePct: number;
  summary: string;
  recommendation: string;
  expectedBenefitCny: number;
  expectedCarbonKg: number;
  strategyRules: AiDispatchRule[];
  timeline: AiTimelineRecord[];
}

export interface SystemNodeStatus {
  id: string;
  label: string;
  type: 'pv' | 'building' | 'ac' | 'storage' | 'grid';
  powerKw: number;
  state: string;
  efficiencyPct: number;
  detail: string;
}

export interface SystemAlert {
  id: string;
  title: string;
  summary: string;
  level: AlertLevel;
  nodeId: string;
  metric: string;
  value: string;
  suggestion: string;
}

export interface PresentationChapter {
  id: string;
  title: string;
  summary: string;
  scenario: ScenarioMode;
  focus: FocusView;
  nodeId: string;
  hourIndex: number;
  durationMs: number;
  highlight: string;
  benefit: string;
}

export interface DashboardRuntimeMeta {
  dataSource: DataSourceMode;
  providerLabel: string;
  lastUpdated: string;
  refreshIntervalSec: number;
}

export interface NodeDetailMetric {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface NodeDetailPreviewPoint {
  hour: string;
  value: number;
}

export interface NodeDetailData {
  nodeId: string;
  title: string;
  subtitle: string;
  healthScore: number;
  recommendation: string;
  strategyLink: string;
  metrics: NodeDetailMetric[];
  preview: NodeDetailPreviewPoint[];
  relatedAlerts: SystemAlert[];
}

export interface DashboardScenarioData {
  scenario: ScenarioMode;
  scenarioLabel: string;
  scenarioSummary: string;
  coreKpi: CoreKpi;
  weather: WeatherSnapshot;
  photovoltaic: PhotovoltaicMetrics;
  airConditioning: AirConditionMetrics;
  storage: StorageMetrics;
  environment: EnvironmentImpact;
  economics: EconomicMetrics;
  energyMix: EnergyMixItem[];
  hourly: HourlyPoint[];
  weekly: WeeklyStat[];
  ai: AiDecisionOutput;
  nodes: SystemNodeStatus[];
}

export interface LiveDashboardSnapshot {
  hourLabel: string;
  coreKpi: CoreKpi;
  weather: WeatherSnapshot;
  photovoltaic: PhotovoltaicMetrics;
  airConditioning: AirConditionMetrics;
  storage: StorageMetrics;
  environment: EnvironmentImpact;
  economics: EconomicMetrics;
  gridImportKw: number;
}
