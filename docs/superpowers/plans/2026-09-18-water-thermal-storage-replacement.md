# Water Thermal Storage Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace EcoChill's battery-storage model with physically consistent chilled-water and hot-water thermal storage while preserving the dashboard structure and presentation flow.

**Architecture:** Put storage equations and state transitions in a framework-independent domain module, then generate seasonal Mock scenarios from those pure functions. Keep electrical and thermal quantities separate in types, charts, KPIs, and 3D flows; Vue components only display derived data.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, Vitest, ECharts, Three.js, SCSS

---

## File map

**Create:**

- `src/domain/thermalStorage.ts`: sensible-heat capacity and bounded state transitions.
- `src/domain/thermalStorage.test.ts`: formula, bound, and mutual-exclusion tests.
- `src/mock/energyMock.test.ts`: electric/thermal balance and seasonal-mode tests.
- `src/components/panels/ThermalStoragePanel.vue`: water-storage status card.
- `src/components/charts/ThermalStorageChart.vue`: storage level and charge/discharge thermal power.
- `src/components/charts/ThermalLoadChart.vue`: thermal demand split between plant and tank.

**Modify:** `package.json`, `package-lock.json`, `src/types/energy.ts`, `src/mock/energyMock.ts`, `src/services/dashboardService.ts`, `src/store/dashboard.ts`, the dashboard panels/charts, `src/components/three/EnergyTwinScene.vue`, `src/three/createEnergyScene.ts`, `README.md`, and the Markdown/DOCX project deliverables under `output/project-document-2026-09-16/`.

## Task 1: Add a tested thermal-storage domain model

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/energy.ts`
- Create: `src/domain/thermalStorage.ts`
- Create: `src/domain/thermalStorage.test.ts`

- [ ] **Step 1: Install Vitest and add test scripts**

Run `npm install --save-dev vitest`, then add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Expected: Vitest appears only in `devDependencies` and its lockfile dependency tree.

- [ ] **Step 2: Replace battery types with thermal-storage types**

Define these public types in `src/types/energy.ts`:

```ts
export type OperatingMode = 'cooling' | 'heating';
export type ThermalStorageState = 'charging' | 'discharging' | 'standby';

export interface ThermalStorageMetrics {
  operationMode: OperatingMode;
  state: ThermalStorageState;
  capacityKwhTh: number;
  storedEnergyKwhTh: number;
  storageLevelPct: number;
  chargePowerKwTh: number;
  dischargePowerKwTh: number;
  tankVolumeM3: number;
  supplyTempC: number;
  returnTempC: number;
  roundTripEfficiencyPct: number;
  availableHours: number;
}

export interface HourlyPoint {
  hour: string;
  photovoltaicKw: number;
  baseElectricLoadKw: number;
  plantElectricPowerKw: number;
  pumpElectricPowerKw: number;
  totalElectricLoadKw: number;
  gridImportKw: number;
  gridExportKw: number;
  thermalLoadKwTh: number;
  plantDirectThermalKwTh: number;
  storageChargeKwTh: number;
  storageDischargeKwTh: number;
  storedEnergyKwhTh: number;
  storageLevelPct: number;
  carbonReductionKg: number;
  savingCny: number;
  priceCny: number;
  irradianceWm2: number;
  ambientTempC: number;
}
```

Add `operationMode` to `DashboardScenarioData`, `LiveDashboardSnapshot`, and `PresentationChapter`. Replace their storage type with `ThermalStorageMetrics`. Rename `CoreKpi.savingRatePct` and `WeeklyStat.savingRatePct` to `peakReductionPct`.

To prevent thermal values from hiding behind electrical field names, also rename `AirConditionZone.loadKw` to `loadKwTh`, `AirConditionMetrics.totalLoadKw` to `thermalLoadKwTh`, and change `SystemNodeStatus` from `powerKw` to the explicit pair `powerValue: number` plus `powerUnit: 'kW' | 'kWth'`.

- [ ] **Step 3: Write failing domain tests**

Create `src/domain/thermalStorage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateSensibleHeatCapacity, deriveAvailableHours, stepThermalStorage } from './thermalStorage';

describe('thermal storage domain', () => {
  it('calculates sensible heat capacity', () => {
    expect(calculateSensibleHeatCapacity(100, 6)).toBeCloseTo(697.8, 1);
  });

  it('clamps charging at capacity', () => {
    const result = stepThermalStorage({
      storedEnergyKwhTh: 680, capacityKwhTh: 700,
      chargePowerKwTh: 100, dischargePowerKwTh: 0,
      durationHours: 1, chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94, standingLossPctPerHour: 0,
    });
    expect(result.storedEnergyKwhTh).toBe(700);
    expect(result.acceptedChargePowerKwTh).toBeCloseTo(21.276, 3);
  });

  it('rejects simultaneous charge and discharge', () => {
    expect(() => stepThermalStorage({
      storedEnergyKwhTh: 350, capacityKwhTh: 700,
      chargePowerKwTh: 40, dischargePowerKwTh: 30,
      durationHours: 1, chargeEfficiency: 0.94,
      dischargeEfficiency: 0.94, standingLossPctPerHour: 0.001,
    })).toThrow('charge and discharge must be mutually exclusive');
  });

  it('derives available hours', () => {
    expect(deriveAvailableHours(500, 0)).toBe(0);
    expect(deriveAvailableHours(500, 125)).toBe(4);
  });
});
```

- [ ] **Step 4: Verify the new tests fail**

Run `npm test -- src/domain/thermalStorage.test.ts`.

Expected: FAIL because `thermalStorage.ts` does not exist.

- [ ] **Step 5: Implement the domain API**

Create `src/domain/thermalStorage.ts` with this public contract:

```ts
export const WATER_HEAT_CAPACITY_KWH_PER_M3_K = 1.163;
export const calculateSensibleHeatCapacity = (volumeM3: number, deltaTempC: number): number;
export const deriveAvailableHours = (storedEnergyKwhTh: number, dischargePowerKwTh: number): number;
export const stepThermalStorage = (input: ThermalStorageStepInput): ThermalStorageStepResult;
```

`stepThermalStorage` must reject non-finite/negative values, reject simultaneous charge and discharge, subtract standing loss, apply charge/discharge efficiency, clamp energy to `[0, capacity]`, and return accepted/delivered power plus `storageLevelPct`.

- [ ] **Step 6: Verify and commit**

Run `npm test -- src/domain/thermalStorage.test.ts`. Expected: PASS.

```bash
git add package.json package-lock.json src/types/energy.ts src/domain
git commit -m "feat: add water thermal storage domain model"
```

## Task 2: Rebuild Mock data with separate electrical and thermal balances

**Files:**
- Modify: `src/mock/energyMock.ts`
- Create: `src/mock/energyMock.test.ts`

- [ ] **Step 1: Write failing balance tests**

Create a test that loops over `cooling/heating` and all four scenarios and checks:

```ts
expect(point.photovoltaicKw + point.gridImportKw).toBeCloseTo(
  point.totalElectricLoadKw + point.gridExportKw,
  6,
);
expect(point.plantDirectThermalKwTh + point.storageDischargeKwTh).toBeCloseTo(
  point.thermalLoadKwTh,
  6,
);
expect(point.storageChargeKwTh * point.storageDischargeKwTh).toBe(0);
expect(point.storageLevelPct).toBeGreaterThanOrEqual(0);
expect(point.storageLevelPct).toBeLessThanOrEqual(100);
```

Also assert `cooling.supplyTempC < cooling.returnTempC`, `heating.supplyTempC > heating.returnTempC`, and that storage discharge is never added as electrical generation.

- [ ] **Step 2: Verify the scenario tests fail**

Run `npm test -- src/mock/energyMock.test.ts`.

Expected: FAIL because the factory still returns battery fields.

- [ ] **Step 3: Implement seasonal scenario parameters**

Use these demonstrator values:

```ts
const thermalConfigByMode = {
  cooling: { tankVolumeM3: 180, supplyTempC: 6, returnTempC: 13, plantCop: 5.2, maxChargePowerKwTh: 180, maxDischargePowerKwTh: 220 },
  heating: { tankVolumeM3: 180, supplyTempC: 45, returnTempC: 35, plantCop: 3.4, maxChargePowerKwTh: 210, maxDischargePowerKwTh: 240 },
} as const;
```

Change the public factories to:

```ts
buildHourlySeries(scenario: ScenarioMode, operationMode: OperatingMode): HourlyPoint[]
buildScenarioData(scenario: ScenarioMode, operationMode: OperatingMode = 'cooling'): DashboardScenarioData
```

Use one-hour steps, capacity from `1.163 × volume × ΔT`, and 32% initial storage. Charge only during valley-price or surplus-PV windows; discharge only during peak/stress windows. Calculate:

```ts
plantDirectThermalKwTh = thermalLoadKwTh - storageDischargeKwTh;
plantElectricPowerKw = (plantDirectThermalKwTh + storageChargeKwTh) / plantCop;
pumpElectricPowerKw = 2 + (storageChargeKwTh + storageDischargeKwTh) * 0.018;
totalElectricLoadKw = baseElectricLoadKw + plantElectricPowerKw + pumpElectricPowerKw;
```

Then split the electric balance into grid import/export. Never subtract `storageDischargeKwTh` from electric demand.

- [ ] **Step 4: Rewrite derived content**

Update storage metrics, nodes, energy mix, KPI calculations, alerts, AI strategies, and presentation chapters. Use mode-aware helpers for `充冷/放冷` and `充热/放热`; replace SOC reserve language with storage level and available cold/heat. Count direct PV displacement for carbon estimates, not thermal discharge itself.

Keep the internal scenario key `heatwave` for API compatibility, but render it as `高温模式` in cooling operation and `寒潮模式` in heating operation. Heating-mode load and ambient-temperature curves must represent cold weather rather than reusing cooling values.

- [ ] **Step 5: Verify and commit**

Run `npm test -- src/domain/thermalStorage.test.ts src/mock/energyMock.test.ts`.

Expected: PASS for all eight mode/scenario combinations.

```bash
git add src/mock/energyMock.ts src/mock/energyMock.test.ts
git commit -m "feat: simulate chilled and hot water storage"
```

## Task 3: Thread seasonal mode through service and store

**Files:**
- Modify: `src/services/dashboardService.ts`
- Modify: `src/store/dashboard.ts`

- [ ] **Step 1: Update the service contract**

Change `getScenarioData` to accept `(scenario, operationMode)`. The Mock implementation calls `buildScenarioData(scenario, operationMode)`; HTTP uses `?mode=${scenario}&operationMode=${operationMode}`.

- [ ] **Step 2: Add store state and switching**

Add `const operationMode = ref<OperatingMode>('cooling')` and:

```ts
const setOperationMode = async (mode: OperatingMode) => {
  operationMode.value = mode;
  await refreshScenarioData(scenario.value, mode);
};
```

Pass both values through initialization, refresh, fallback, and presentation chapters.

- [ ] **Step 3: Replace storage detail fields**

Use storage level, available `kWhth`, charge/discharge `kWth`, supply/return temperatures, tank volume, and available hours. Make the preview series use `storageLevelPct`. Recommendations must prepare capacity before the peak and preserve a minimum reserve.

- [ ] **Step 4: Verify and commit**

Run `npm test` and `npm run type-check`.

Expected: tests PASS; any remaining type errors are limited to Vue/Three files migrated next.

```bash
git add src/services/dashboardService.ts src/store/dashboard.ts
git commit -m "feat: add seasonal thermal storage state"
```

## Task 4: Replace battery UI with water-storage UI

**Files:**
- Create: `src/components/panels/ThermalStoragePanel.vue`
- Create: `src/components/charts/ThermalStorageChart.vue`
- Create: `src/components/charts/ThermalLoadChart.vue`
- Modify: `src/components/layout/TopHeader.vue`
- Modify: `src/components/panels/RightPanel.vue`
- Modify: `src/components/panels/BottomPanel.vue`
- Modify: `src/components/panels/AiDecisionPanel.vue`
- Modify: `src/components/panels/AiTimelinePanel.vue`
- Modify: `src/components/panels/EquipmentDetailModal.vue`
- Modify: `src/components/charts/PowerTrendChart.vue`
- Modify: `src/components/charts/EnergyMixChart.vue`
- Modify: `src/components/charts/SavingsCarbonChart.vue`
- Modify: `src/components/charts/RevenueTrendChart.vue`

- [ ] **Step 1: Add the seasonal switch and correct KPIs**

Add `制冷季 / 水蓄冷` and `供热季 / 水蓄热` buttons to `TopHeader.vue`, bound to `store.setOperationMode`. Rename `今日节能率` to `峰值削减率` and bind `peakReductionPct`.

- [ ] **Step 2: Create the storage status card**

`ThermalStoragePanel.vue` displays mode-aware state, a 0–100% level bar, available `kWhth`, charge/discharge `kWth`, supply/return temperatures, tank volume, available hours, and a button calling `store.openDetail('storage')`. It performs no energy calculations.

- [ ] **Step 3: Insert the card in the right rail**

Place it between the HVAC card and AI panel. Change the right-panel grid to three content rows while retaining responsive one-column behavior.

- [ ] **Step 4: Add separated thermal charts**

`ThermalStorageChart.vue` plots charge/discharge `kWth` plus storage level `%` on a second axis. `ThermalLoadChart.vue` plots building demand, direct plant supply, and tank discharge in `kWth`, with cold/heat labels chosen from the operating mode.

- [ ] **Step 5: Correct existing chart boundaries**

- Power chart: PV, total electric load, plant electricity, grid import; axis `kW`.
- Energy mix: PV direct supply and grid electricity only.
- Savings chart: `peakReductionPct`, labelled `峰值削减率`.
- Revenue chart: label benefit `移峰节费`.
- Bottom panel: provide electric, thermal-load, storage, carbon, revenue, and timeline views without mixing units.

- [ ] **Step 6: Remove battery terminology**

Run:

```bash
rg -n "SOC|PCS|电池|节能率|storageChargeKw\b|storageDischargeKw\b" src/components
```

Expected: no user-facing battery terms or obsolete fields remain.

- [ ] **Step 7: Verify and commit**

Run `npm test`, `npm run type-check`, and `npm run build`. Inspect both modes at desktop and 1024px widths.

```bash
git add src/components
git commit -m "feat: present water thermal storage metrics"
```

## Task 5: Replace the 3D battery cabinet with a water tank

**Files:**
- Modify: `src/three/createEnergyScene.ts`
- Modify: `src/components/three/EnergyTwinScene.vue`

- [ ] **Step 1: Replace storage geometry**

Replace `createStorage()` with a tank group at the same position and `storage` node id. Use a vertical cylinder shell, translucent cold/hot layer cylinders, upper/lower pipe stubs, and a small pump skid. Label it `分层蓄能水罐`.

- [ ] **Step 2: Replace impossible flow paths**

Use `pv-plant`, `grid-plant`, `plant-storage`, and `storage-buildings`. Electrical paths end at the plant; the plant-to-tank path charges; the tank-to-buildings path discharges. Do not draw PV directly into the tank.

- [ ] **Step 3: Add scene APIs**

Expose:

```ts
updateOperatingMode(mode: OperatingMode): void;
updateThermalState(storage: ThermalStorageMetrics): void;
```

Use blue/cyan for cooling and orange/red for heating. Fill the tank from `storageLevelPct`; enable only the charge or discharge thermal path matching the current state.

- [ ] **Step 4: Wire watchers, verify, and commit**

Watch store mode and storage metrics in `EnergyTwinScene.vue`; change the legend to mode-aware water-storage wording. Run type check/build and inspect charge, discharge, standby, selection, and detail opening.

```bash
git add src/three/createEnergyScene.ts src/components/three/EnergyTwinScene.vue
git commit -m "feat: render stratified water storage twin"
```

## Task 6: Update README and project deliverables

**Files:**
- Modify: `README.md`
- Modify: `output/project-document-2026-09-16/EcoChill项目文档.md`
- Modify: `output/project-document-2026-09-16/EcoChill项目文档.docx`

- [ ] **Step 1: Rewrite README architecture and terminology**

Describe “光伏 + 空调冷热负荷 + 水蓄冷/蓄热 + AI 调度”, the seasonal switch, stratified tank/pumps/heat exchange, and separate electrical/thermal balances. Replace stale `/Volumes/高达 RX/...` links with repository-relative links.

- [ ] **Step 2: Rewrite the project document**

Preserve its distinction between energy saving, load shifting, and bill reduction. Add valley-price/surplus-PV charging, default partial-storage operation, the `1.163 × m³ × ℃` capacity formula, explicit `kW/kWth` and `kWh/kWhth`, and site-specific sizing limits.

- [ ] **Step 3: Regenerate the DOCX using the document workflow**

Invoke `documents:documents`, regenerate the DOCX from the revised source, render every page, and inspect for truncated tables, orphan headings, incorrect units, and broken Chinese fonts.

- [ ] **Step 4: Scan, verify, and commit**

Run:

```bash
rg -n "SOC|PCS|BMS|储能电池|电池柜|电池放电" README.md output/project-document-2026-09-16/EcoChill项目文档.md
```

Expected: no battery-system claims remain except clearly labelled historical comparisons.

```bash
git add README.md output/project-document-2026-09-16/EcoChill项目文档.md output/project-document-2026-09-16/EcoChill项目文档.docx
git commit -m "docs: describe water thermal storage system"
```

## Task 7: Final verification and cleanup

**Files:**
- Modify only files required to fix verification findings.

- [ ] **Step 1: Run all automated checks**

Run `npm test`, `npm run type-check`, and `npm run build`.

Expected: all tests pass, TypeScript reports zero errors, and production build exits 0.

- [ ] **Step 2: Scan terminology and units**

```bash
rg -n "SOC|PCS|BMS|储能电池|电池柜|storageChargeKw\b|storageDischargeKw\b|savingRatePct" src README.md output/project-document-2026-09-16/EcoChill项目文档.md
rg -n "kWth|kWhth|storageLevelPct|operationMode" src README.md output/project-document-2026-09-16/EcoChill项目文档.md
```

Expected: the first scan finds no obsolete runtime concepts; the second confirms thermal units and seasonal mode across model, UI, and documentation.

- [ ] **Step 3: Smoke-test presentation paths**

Start `npm run dev` and inspect normal/high-temperature/cloudy/peak-price cooling, normal/peak-price heating, the storage modal, and full presentation autoplay. Confirm no console errors, 0–100% storage level, correct units, and no battery visuals/text.

- [ ] **Step 4: Review the final diff**

Run `git status --short` and `git diff --check`. Preserve unrelated user files, especially anything outside the planned paths.

- [ ] **Step 5: Commit verification fixes only if needed**

```bash
git add -p
git commit -m "fix: close thermal storage verification gaps"
```

Do not create an empty commit when verification requires no changes.
