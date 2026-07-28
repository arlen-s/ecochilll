# Command Center UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current card-heavy dashboard with a responsive industrial command-center shell while preserving all Mock business capabilities.

**Architecture:** Build a token-based visual system and six page regions: command header, supply rail, twin viewport, dispatch rail, analytics dock, and inspector drawer. Keep the current Three.js scene as a temporary viewport implementation; plan 3 replaces its internals after the new UI is stable.

**Tech Stack:** Vue 3, Pinia, TypeScript, SCSS, Lucide Vue, ECharts core, Vitest, Vue Test Utils

---

## Execution Order

This is plan 2 of 4. Start only after `2026-07-28-mock-simulation-foundation.md` passes. The final state must remain functional with the old Three.js scene so that UI and 3D regressions are isolated.

## File Map

**Create:**

- `src/components/common/IconButton.vue` — accessible icon command.
- `src/components/common/PanelFrame.vue` — restrained industrial section frame.
- `src/components/common/Sparkline.vue` — lightweight SVG micro-trend.
- `src/components/layout/CommandHeader.vue` — brand, KPI, scenarios, and playback.
- `src/components/presentation/SimulationTimeline.vue` — seek, play, and speed controls.
- `src/components/panels/SupplyRail.vue` — photovoltaic, weather, and energy mix.
- `src/components/panels/DispatchRail.vue` — AI action, HVAC, storage, and alerts.
- `src/components/panels/AnalyticsDock.vue` — collapsible lazy-loaded analysis tabs.
- `src/components/panels/DeviceInspectorDrawer.vue` — non-blocking equipment detail.
- `src/charts/echarts.ts` — modular ECharts registration.
- `src/components/layout/CommandHeader.spec.ts`
- `src/components/presentation/SimulationTimeline.spec.ts`
- `src/components/panels/AnalyticsDock.spec.ts`
- `src/components/panels/DeviceInspectorDrawer.spec.ts`

**Modify:**

- `package.json`
- `package-lock.json`
- `src/style.scss`
- `src/views/DashboardView.vue`
- `src/components/charts/BaseChart.vue`
- `src/components/charts/chartTheme.ts`
- `src/components/charts/PowerTrendChart.vue`
- `src/components/charts/SavingsCarbonChart.vue`
- `src/components/charts/RevenueTrendChart.vue`
- `src/components/panels/AiDecisionPanel.vue`
- `src/components/three/EnergyTwinScene.vue`

**Delete after migration:**

- `src/components/layout/TopHeader.vue`
- `src/components/layout/SectionCard.vue`
- `src/components/presentation/DashboardCommandBar.vue`
- `src/components/panels/LeftPanel.vue`
- `src/components/panels/RightPanel.vue`
- `src/components/panels/BottomPanel.vue`
- `src/components/panels/EquipmentDetailModal.vue`
- `src/components/common/FocusPanelModal.vue`
- `src/components/charts/GenerationTrendChart.vue`
- `src/components/charts/LoadTrendChart.vue`
- `src/components/charts/EnergyMixChart.vue`

## Task 1: Add the Icon Dependency and Design Tokens

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/style.scss`

- [ ] **Step 1: Install Lucide Vue**

Run:

```bash
npm install lucide-vue-next
```

Expected: npm exits with code 0 and locks one direct runtime dependency.

- [ ] **Step 2: Replace the global palette and surface rules**

Replace the `:root`, page background, `.glass-card`, `.metric-chip`, and `.panel-action-btn` rules in `src/style.scss` with:

```scss
:root {
  color-scheme: dark;
  font-family: 'Bahnschrift', 'DIN Alternate', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --surface-0: #050708;
  --surface-1: #0a0e11;
  --surface-2: #10161a;
  --surface-3: #161d21;
  --line-subtle: rgba(187, 216, 220, 0.12);
  --line-active: rgba(63, 224, 218, 0.55);
  --text-primary: #edf5f3;
  --text-secondary: rgba(220, 234, 231, 0.66);
  --text-muted: rgba(195, 211, 208, 0.42);
  --signal-cyan: #3fe0da;
  --signal-green: #54dc91;
  --signal-amber: #f2b84b;
  --signal-red: #ef6268;
  --signal-blue: #6aa9ff;
  --panel-radius: 6px;
  --control-radius: 4px;
  --header-height: 68px;
  --dock-height: 224px;
  --motion-fast: 180ms;
  --motion-normal: 240ms;
}

html,
body,
#app {
  width: 100%;
  min-height: 100%;
  margin: 0;
  background-color: var(--surface-0);
  color: var(--text-primary);
}

body {
  min-width: 320px;
  overflow-x: hidden;
  font-variant-numeric: tabular-nums;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(132, 170, 171, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(132, 170, 171, 0.035) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, black, transparent 72%);
}

button,
input,
select {
  font: inherit;
}

button:focus-visible,
input:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--signal-cyan);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 3: Verify styles compile before component migration**

Run:

```bash
npm run build
```

Expected: build passes; temporary visual mismatches are acceptable until Task 7.

- [ ] **Step 4: Commit the design foundation**

```bash
git add package.json package-lock.json src/style.scss
git commit -m "style: establish industrial command center tokens"
```

## Task 2: Add the Shared UI Primitives

**Files:**

- Create: `src/components/common/IconButton.vue`
- Create: `src/components/common/PanelFrame.vue`
- Create: `src/components/common/Sparkline.vue`

- [ ] **Step 1: Create the icon button**

Create `src/components/common/IconButton.vue`:

```vue
<template>
  <button
    class="icon-button"
    :class="{ 'icon-button--active': active }"
    type="button"
    :aria-label="label"
    :aria-pressed="toggle ? active : undefined"
    :title="label"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; active?: boolean; toggle?: boolean }>(), {
  active: false,
  toggle: false,
});
</script>

<style scoped lang="scss">
.icon-button {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--line-subtle);
  border-radius: var(--control-radius);
  background: rgba(12, 18, 21, 0.86);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast);
}
.icon-button:hover,
.icon-button--active {
  border-color: var(--line-active);
  background: rgba(63, 224, 218, 0.09);
  color: var(--signal-cyan);
}
</style>
```

- [ ] **Step 2: Create the industrial panel frame**

Create `src/components/common/PanelFrame.vue`:

```vue
<template>
  <section class="panel-frame">
    <header class="panel-frame__header">
      <div>
        <span>{{ eyebrow }}</span>
        <h2>{{ title }}</h2>
      </div>
      <slot name="actions" />
    </header>
    <div class="panel-frame__body"><slot /></div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; eyebrow?: string }>(), { eyebrow: 'SYSTEM' });
</script>

<style scoped lang="scss">
.panel-frame {
  min-width: 0;
  border-top: 1px solid var(--line-subtle);
  background: rgba(10, 14, 17, 0.78);
}
.panel-frame__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line-subtle);
}
.panel-frame__header span {
  display: block;
  margin-bottom: 2px;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
}
.panel-frame__header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.panel-frame__body { min-width: 0; padding: 12px; }
</style>
```

- [ ] **Step 3: Create the zero-dependency sparkline**

Create `src/components/common/Sparkline.vue`:

```vue
<template>
  <svg class="sparkline" viewBox="0 0 120 36" role="img" :aria-label="label">
    <polyline :points="points" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ values: number[]; label: string }>();
const points = computed(() => {
  const min = Math.min(...props.values);
  const max = Math.max(...props.values);
  const range = Math.max(max - min, 1);
  return props.values.map((value, index) => {
    const x = (index / Math.max(props.values.length - 1, 1)) * 120;
    const y = 32 - ((value - min) / range) * 28;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});
</script>

<style scoped lang="scss">
.sparkline { display: block; width: 100%; height: 36px; overflow: visible; }
.sparkline polyline { fill: none; stroke: var(--signal-cyan); stroke-width: 1.5; }
</style>
```

- [ ] **Step 4: Run type checking and commit**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/components/common/IconButton.vue src/components/common/PanelFrame.vue src/components/common/Sparkline.vue
git commit -m "feat: add command center UI primitives"
```

## Task 3: Build the Simulation Timeline and Command Header

**Files:**

- Create: `src/components/presentation/SimulationTimeline.vue`
- Create: `src/components/presentation/SimulationTimeline.spec.ts`
- Create: `src/components/layout/CommandHeader.vue`
- Create: `src/components/layout/CommandHeader.spec.ts`

- [ ] **Step 1: Write the failing timeline interaction test**

Create `src/components/presentation/SimulationTimeline.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import SimulationTimeline from './SimulationTimeline.vue';
import { useSimulationStore } from '@/store/simulation';

describe('SimulationTimeline', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('seeks, toggles, and changes speed', async () => {
    const wrapper = mount(SimulationTimeline);
    const store = useSimulationStore();
    await wrapper.get('input[type="range"]').setValue('1140');
    await wrapper.get('[data-testid="timeline-toggle"]').trigger('click');
    await wrapper.get('[data-testid="speed-2"]').trigger('click');
    expect(store.minuteOfDay).toBe(1140);
    expect(store.playing).toBe(true);
    expect(store.speed).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- src/components/presentation/SimulationTimeline.spec.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the timeline control**

Create `src/components/presentation/SimulationTimeline.vue` with this public structure:

```vue
<template>
  <div class="simulation-timeline">
    <button data-testid="timeline-toggle" type="button" :aria-label="store.playing ? '暂停仿真' : '播放仿真'" @click="store.toggle()">
      <Pause v-if="store.playing" :size="15" />
      <Play v-else :size="15" />
    </button>
    <time>{{ store.timeLabel }}</time>
    <input
      type="range"
      min="0"
      max="1439"
      step="5"
      :value="store.minuteOfDay"
      aria-label="仿真时间"
      @input="store.seek(Number(($event.target as HTMLInputElement).value))"
    />
    <div class="simulation-timeline__speeds" aria-label="播放速度">
      <button
        v-for="speed in ([1, 2, 4] as const)"
        :key="speed"
        :data-testid="`speed-${speed}`"
        type="button"
        :class="{ active: store.speed === speed }"
        @click="store.setSpeed(speed)"
      >{{ speed }}×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next';
import { useSimulationStore } from '@/store/simulation';
const store = useSimulationStore();
</script>
```

Add the following component styles:

```scss
.simulation-timeline {
  display: grid;
  grid-template-columns: 36px 64px minmax(120px, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.simulation-timeline > button,
.simulation-timeline__speeds button {
  height: 32px;
  border: 1px solid var(--line-subtle);
  border-radius: var(--control-radius);
  background: var(--surface-1);
  color: var(--text-secondary);
}
.simulation-timeline > button { width: 36px; padding: 0; }
.simulation-timeline time { color: var(--signal-cyan); font-size: 13px; text-align: center; }
.simulation-timeline input { width: 100%; accent-color: var(--signal-cyan); }
.simulation-timeline__speeds { display: grid; grid-template-columns: repeat(3, 32px); }
.simulation-timeline__speeds button.active { border-color: var(--line-active); color: var(--signal-cyan); }
@media (max-width: 720px) {
  .simulation-timeline { grid-template-columns: 36px 56px minmax(0, 1fr); }
  .simulation-timeline input { grid-column: 1 / -1; grid-row: 2; }
  .simulation-timeline__speeds { grid-template-columns: repeat(2, 32px); justify-self: end; }
  .simulation-timeline__speeds button:last-child { display: none; }
}
```

- [ ] **Step 4: Run the timeline test**

Run:

```bash
npm test -- src/components/presentation/SimulationTimeline.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing command-header test**

Create `src/components/layout/CommandHeader.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import CommandHeader from './CommandHeader.vue';
import { usePresentationStore } from '@/store/presentation';
import { useSimulationStore } from '@/store/simulation';

describe('CommandHeader', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('switches the visible scenario from the segmented control', async () => {
    const wrapper = mount(CommandHeader);
    await wrapper.get('[data-scenario="cloudy"]').trigger('click');
    expect(useSimulationStore().scenario).toBe('cloudy');
  });

  it('starts the deterministic presentation from the command area', async () => {
    const wrapper = mount(CommandHeader);
    await wrapper.get('[data-testid="presentation-toggle"]').trigger('click');
    expect(wrapper.text()).toContain('答辩运行中');
    usePresentationStore().stop();
  });
});
```

- [ ] **Step 6: Implement the command header**

Create `src/components/layout/CommandHeader.vue` with four zones:

```vue
<template>
  <header class="command-header">
    <div class="command-header__brand">
      <span class="command-header__mark">EC</span>
      <div><strong>EcoChill</strong><small>校园能源协同调度中心</small></div>
    </div>
    <div class="command-header__kpis">
      <span>总功率 <strong>{{ live.coreKpi.totalPowerKw }} kW</strong></span>
      <span>绿电 <strong>{{ live.coreKpi.greenEnergyRatioPct.toFixed(1) }}%</strong></span>
      <span>节能 <strong>{{ live.coreKpi.savingRatePct.toFixed(1) }}%</strong></span>
    </div>
    <SimulationTimeline class="command-header__timeline" />
    <div class="command-header__scenarios" aria-label="场景模式">
      <button
        v-for="item in scenarios"
        :key="item.value"
        type="button"
        :data-scenario="item.value"
        :class="{ active: simulation.scenario === item.value }"
        @click="simulation.setScenario(item.value)"
      >{{ item.label }}</button>
    </div>
    <div class="command-header__presentation">
      <span>{{ presentation.active ? (presentation.paused ? '答辩已暂停' : '答辩运行中') : '答辩待命' }}</span>
      <IconButton data-testid="presentation-toggle" :label="presentation.active && !presentation.paused ? '暂停答辩' : '播放答辩'" @click="presentation.toggle()">
        <Pause v-if="presentation.active && !presentation.paused" :size="16" />
        <Play v-else :size="16" />
      </IconButton>
      <IconButton label="下一答辩章节" :disabled="!presentation.active" @click="presentation.next()"><SkipForward :size="16" /></IconButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Pause, Play, SkipForward } from 'lucide-vue-next';
import IconButton from '@/components/common/IconButton.vue';
import SimulationTimeline from '@/components/presentation/SimulationTimeline.vue';
import { usePresentationStore } from '@/store/presentation';
import { useSimulationStore } from '@/store/simulation';
import type { ScenarioMode } from '@/types/energy';

const simulation = useSimulationStore();
const presentation = usePresentationStore();
const live = computed(() => simulation.liveSnapshot);
const scenarios: Array<{ label: string; value: ScenarioMode }> = [
  { label: '常态', value: 'normal' },
  { label: '高温', value: 'heatwave' },
  { label: '阴天', value: 'cloudy' },
  { label: '峰价', value: 'peakPricing' },
];
</script>
```

Use a stable 68px desktop height. Keep presentation commands at the far right. At 1440px, move the timeline below the brand/KPI row. At 720px, show brand, two primary KPIs, scenario segments, timeline, and compact presentation commands without horizontal overflow.

- [ ] **Step 7: Run component tests and commit**

Run:

```bash
npm test -- src/components/presentation/SimulationTimeline.spec.ts src/components/layout/CommandHeader.spec.ts
```

Expected: both test files pass.

```bash
git add src/components/presentation/SimulationTimeline.vue src/components/presentation/SimulationTimeline.spec.ts src/components/layout/CommandHeader.vue src/components/layout/CommandHeader.spec.ts
git commit -m "feat: add command header and simulation controls"
```

## Task 4: Build the Supply and Dispatch Rails

**Files:**

- Create: `src/components/panels/SupplyRail.vue`
- Create: `src/components/panels/DispatchRail.vue`
- Modify: `src/components/panels/AiDecisionPanel.vue`

- [ ] **Step 1: Implement the supply rail**

Create `src/components/panels/SupplyRail.vue` using three `PanelFrame` sections:

```vue
<template>
  <aside class="supply-rail" aria-label="能源供给侧">
    <PanelFrame title="光伏供给" eyebrow="SUPPLY / PV">
      <div class="rail-primary"><strong>{{ live.photovoltaic.powerKw }}</strong><span>kW</span></div>
      <Sparkline :values="pvTrend" label="24 小时光伏趋势" />
      <dl class="rail-metrics">
        <div><dt>累计发电</dt><dd>{{ live.photovoltaic.todayGenerationKwh }} kWh</dd></div>
        <div><dt>组件效率</dt><dd>{{ live.photovoltaic.efficiencyPct.toFixed(1) }}%</dd></div>
        <div><dt>辐照强度</dt><dd>{{ live.photovoltaic.irradianceWm2 }} W/m²</dd></div>
      </dl>
    </PanelFrame>
    <PanelFrame title="环境状态" eyebrow="ENVIRONMENT">
      <div class="weather-summary"><strong>{{ live.weather.ambientTempC.toFixed(1) }}°</strong><span>{{ live.weather.weatherText }}</span></div>
      <dl class="rail-metrics rail-metrics--two">
        <div><dt>湿度</dt><dd>{{ live.weather.humidityPct.toFixed(0) }}%</dd></div>
        <div><dt>云量</dt><dd>{{ live.weather.cloudCoverPct.toFixed(0) }}%</dd></div>
        <div><dt>风速</dt><dd>{{ live.weather.windSpeedMs.toFixed(1) }} m/s</dd></div>
        <div><dt>舒适度</dt><dd>{{ live.weather.comfortIndex.toFixed(0) }}</dd></div>
      </dl>
    </PanelFrame>
    <PanelFrame title="能源结构" eyebrow="ENERGY MIX">
      <div class="energy-mix" role="img" aria-label="光伏、储能与电网能源占比">
        <span v-for="item in simulation.scenarioData.energyMix" :key="item.name" :style="{ flexGrow: item.value, backgroundColor: item.color }" />
      </div>
      <ul class="energy-legend"><li v-for="item in simulation.scenarioData.energyMix" :key="item.name"><span :style="{ backgroundColor: item.color }" />{{ item.name }} <strong>{{ item.value }}%</strong></li></ul>
    </PanelFrame>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PanelFrame from '@/components/common/PanelFrame.vue';
import Sparkline from '@/components/common/Sparkline.vue';
import { useSimulationStore } from '@/store/simulation';
const simulation = useSimulationStore();
const live = computed(() => simulation.liveSnapshot);
const pvTrend = computed(() => simulation.scenarioData.hourly.map((point) => point.photovoltaicKw));
</script>
```

Style the rail as one continuous surface with 1px separators. Keep all radii at 6px or below. Do not wrap metrics in nested cards.

- [ ] **Step 2: Rebuild AI decision content as an operational block**

Modify `src/components/panels/AiDecisionPanel.vue` so it no longer wraps itself in `SectionCard`. Its root must expose:

```vue
<section class="ai-decision" aria-labelledby="ai-decision-title">
  <header>
    <div><span>AI DISPATCH</span><h3 id="ai-decision-title">{{ ai.title }}</h3></div>
    <strong>{{ ai.confidencePct }}%</strong>
  </header>
  <p>{{ ai.recommendation }}</p>
  <dl>
    <div><dt>预期收益</dt><dd>¥{{ ai.expectedBenefitCny }}</dd></div>
    <div><dt>预期减碳</dt><dd>{{ ai.expectedCarbonKg }} kg</dd></div>
  </dl>
  <button type="button" @click="twin.openInspector('ac')">查看执行对象</button>
</section>
```

Use this script:

```ts
import { computed } from 'vue';
import { useSimulationStore } from '@/store/simulation';
import { useTwinStore } from '@/store/twin';

const simulation = useSimulationStore();
const twin = useTwinStore();
const ai = computed(() => simulation.scenarioData.ai);
```

Remove the `SectionCard` and `useDashboardStore` imports. Remove the three repeated strategy cards from the default rail; strategy details remain available in the inspector and analytics timeline.

- [ ] **Step 3: Implement the dispatch rail**

Create `src/components/panels/DispatchRail.vue` with this order:

```vue
<template>
  <aside class="dispatch-rail" aria-label="能源调度侧">
    <PanelFrame title="智能调度" eyebrow="DECISION"><AiDecisionPanel /></PanelFrame>
    <PanelFrame title="负荷与舒适度" eyebrow="HVAC">
      <div class="dispatch-primary"><strong>{{ live.airConditioning.totalLoadKw }}</strong><span>kW</span><em>{{ live.airConditioning.runningStatus }}</em></div>
      <button v-for="zone in live.airConditioning.zones" :key="zone.id" type="button" class="zone-row" @click="twin.selectNode(nodeIdForZone(zone.id), { openInspector: true })">
        <span>{{ zone.name }}</span><strong>{{ zone.loadKw }} kW</strong><small>{{ zone.indoorTempC.toFixed(1) }}° / 舒适 {{ zone.comfortPct.toFixed(0) }}%</small>
      </button>
    </PanelFrame>
    <PanelFrame title="储能执行" eyebrow="STORAGE">
      <div class="soc-gauge" :style="{ '--soc': `${live.storage.socPct}%` }"><strong>{{ live.storage.socPct.toFixed(0) }}%</strong><span>SOC</span></div>
      <dl class="rail-metrics rail-metrics--two"><div><dt>充电</dt><dd>{{ live.storage.chargePowerKw }} kW</dd></div><div><dt>放电</dt><dd>{{ live.storage.dischargePowerKw }} kW</dd></div></dl>
    </PanelFrame>
    <PanelFrame title="活动告警" eyebrow="ALERTS">
      <button v-for="alert in simulation.activeAlerts.slice(0, 3)" :key="alert.id" type="button" :class="['alert-row', `alert-row--${alert.level}`]" @click="twin.selectNode(alert.nodeId, { openInspector: true })">
        <span>{{ alert.title }}</span><strong>{{ alert.value }}</strong>
      </button>
    </PanelFrame>
  </aside>
</template>
```

Use `useSimulationStore` and `useTwinStore`. The rail must fit within 1080px without internal text overlap; allow the whole page to scroll below 900px height.

Map Mock HVAC zone IDs to existing scene node IDs in the script:

```ts
const zoneNodeIds: Record<string, string> = {
  z1: 'building-a',
  z2: 'building-b',
  z3: 'building-c',
  z4: 'ac',
};
const nodeIdForZone = (zoneId: string) => zoneNodeIds[zoneId] ?? 'ac';
```

- [ ] **Step 4: Type-check and commit the rails**

Run:

```bash
npm run type-check
```

Expected: PASS.

```bash
git add src/components/panels/SupplyRail.vue src/components/panels/DispatchRail.vue src/components/panels/AiDecisionPanel.vue
git commit -m "feat: add supply and dispatch rails"
```

## Task 5: Modularize ECharts and Build the Analytics Dock

**Files:**

- Create: `src/charts/echarts.ts`
- Modify: `src/components/charts/BaseChart.vue`
- Modify: `src/components/charts/chartTheme.ts`
- Create: `src/components/panels/AnalyticsDock.vue`
- Create: `src/components/panels/AnalyticsDock.spec.ts`

- [ ] **Step 1: Register only used ECharts modules**

Create `src/charts/echarts.ts`:

```ts
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type MarkLineComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type DashboardChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | TooltipComponentOption
>;

export { echarts };
```

- [ ] **Step 2: Update the base chart import and resize behavior**

In `src/components/charts/BaseChart.vue`, replace full-package imports and deep watch with:

```ts
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { echarts, type DashboardChartOption } from '@/charts/echarts';

const props = defineProps<{ option: DashboardChartOption }>();
const container = ref<HTMLElement>();
let chart: ReturnType<typeof echarts.init> | null = null;
let observer: ResizeObserver | null = null;

const render = () => {
  if (!container.value) return;
  chart ??= echarts.init(container.value, undefined, { renderer: 'canvas' });
  chart.setOption(props.option, { notMerge: true, lazyUpdate: true });
};

onMounted(() => {
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(container.value!);
});
watchEffect(render);
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); chart = null; });
```

Move the chart option implementation type to `src/charts/echarts.ts`. During this task, keep the following compatibility re-export at the top of `src/components/charts/chartTheme.ts`, then import the type directly from `@/charts/echarts` in the three retained trend charts:

```ts
export type { DashboardChartOption } from '@/charts/echarts';
```

- [ ] **Step 3: Write the failing analytics dock test**

Create `src/components/panels/AnalyticsDock.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import AnalyticsDock from './AnalyticsDock.vue';

describe('AnalyticsDock', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('switches one active analysis panel at a time', async () => {
    const wrapper = shallowMount(AnalyticsDock);
    await wrapper.get('[data-tab="saving"]').trigger('click');
    expect(wrapper.get('[data-testid="analytics-dock"]').attributes('data-active-tab')).toBe('saving');
    expect(wrapper.findAll('[aria-selected="true"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Implement the lazy analytics dock**

Create `src/components/panels/AnalyticsDock.vue`:

```vue
<template>
  <section data-testid="analytics-dock" class="analytics-dock" :class="{ 'analytics-dock--collapsed': collapsed }" :data-active-tab="activeTab">
    <header>
      <div role="tablist" aria-label="分析工作台">
        <button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :data-tab="tab.id" :aria-selected="activeTab === tab.id" @click="activeTab = tab.id">{{ tab.label }}</button>
      </div>
      <IconButton :label="collapsed ? '展开分析工作台' : '收起分析工作台'" @click="collapsed = !collapsed"><ChevronUp v-if="collapsed" :size="16" /><ChevronDown v-else :size="16" /></IconButton>
    </header>
    <div v-if="!collapsed" class="analytics-dock__content" role="tabpanel">
      <component :is="activeComponent" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import IconButton from '@/components/common/IconButton.vue';

type AnalyticsTab = 'power' | 'saving' | 'revenue' | 'timeline';
const activeTab = ref<AnalyticsTab>('power');
const collapsed = ref(false);
const tabs: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'power', label: '功率趋势' },
  { id: 'saving', label: '节能碳排' },
  { id: 'revenue', label: '收益分析' },
  { id: 'timeline', label: '决策记录' },
];
const components = {
  power: defineAsyncComponent(() => import('@/components/charts/PowerTrendChart.vue')),
  saving: defineAsyncComponent(() => import('@/components/charts/SavingsCarbonChart.vue')),
  revenue: defineAsyncComponent(() => import('@/components/charts/RevenueTrendChart.vue')),
  timeline: defineAsyncComponent(() => import('@/components/panels/AiTimelinePanel.vue')),
};
const activeComponent = computed(() => components[activeTab.value]);
</script>
```

Give the expanded dock a stable 224px height and the collapsed dock a 44px height. The active chart must fill the content area without changing dock height.

- [ ] **Step 5: Run tests, build, and inspect split chunks**

Run:

```bash
npm test -- src/components/panels/AnalyticsDock.spec.ts
npm run build
find dist/assets -maxdepth 1 -type f -print
```

Expected: test passes; the build produces independent lazy analysis chunks instead of one chart-only entry path.

- [ ] **Step 6: Commit chart modularization and the dock**

```bash
git add src/charts/echarts.ts src/components/charts/BaseChart.vue src/components/charts/chartTheme.ts src/components/charts/PowerTrendChart.vue src/components/charts/SavingsCarbonChart.vue src/components/charts/RevenueTrendChart.vue src/components/panels/AnalyticsDock.vue src/components/panels/AnalyticsDock.spec.ts
git commit -m "perf: lazy load modular analytics charts"
```

## Task 6: Replace the Modal with an Inspector Drawer

**Files:**

- Create: `src/components/panels/DeviceInspectorDrawer.vue`
- Create: `src/components/panels/DeviceInspectorDrawer.spec.ts`

- [ ] **Step 1: Write the failing drawer test**

Create `src/components/panels/DeviceInspectorDrawer.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import DeviceInspectorDrawer from './DeviceInspectorDrawer.vue';
import { useDashboardStore } from '@/store/dashboard';

describe('DeviceInspectorDrawer', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('exposes dialog semantics and closes with Escape', async () => {
    const store = useDashboardStore();
    store.openDetail('storage');
    const wrapper = mount(DeviceInspectorDrawer, {
      attachTo: document.body,
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('false');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(store.detailVisible).toBe(false);
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- src/components/panels/DeviceInspectorDrawer.spec.ts
```

Expected: FAIL because the drawer component does not exist.

- [ ] **Step 3: Implement the drawer**

Create `src/components/panels/DeviceInspectorDrawer.vue`. Reuse the current `selectedNodeDetail` data, but render a right-edge drawer:

```vue
<template>
  <Teleport to="body">
    <Transition name="inspector-slide">
      <aside v-if="store.detailVisible" class="device-inspector" role="dialog" aria-modal="false" :aria-labelledby="titleId">
        <header><div><span>{{ detail.subtitle }}</span><h2 :id="titleId">{{ detail.title }}</h2></div><IconButton label="关闭设备详情" @click="store.closeDetail()"><X :size="18" /></IconButton></header>
        <section><h3>健康评分</h3><strong class="health-score">{{ detail.healthScore }}</strong></section>
        <section><h3>核心指标</h3><dl><div v-for="metric in detail.metrics" :key="metric.label"><dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd></div></dl></section>
        <section><h3>AI 建议</h3><p>{{ detail.recommendation }}</p></section>
        <section v-if="detail.relatedAlerts.length"><h3>关联告警</h3><button v-for="alert in detail.relatedAlerts" :key="alert.id" type="button">{{ alert.title }} · {{ alert.value }}</button></section>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { X } from 'lucide-vue-next';
import IconButton from '@/components/common/IconButton.vue';
import { useDashboardStore } from '@/store/dashboard';
const store = useDashboardStore();
const detail = computed(() => store.selectedNodeDetail);
const titleId = 'device-inspector-title';
const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') store.closeDetail(); };
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>
```

Desktop width: 380px. Mobile width: 100vw. Use `transform: translateX(100%)` for the enter/leave transition. Do not add a page-blocking backdrop.

- [ ] **Step 4: Run the test and commit**

Run:

```bash
npm test -- src/components/panels/DeviceInspectorDrawer.spec.ts
```

Expected: PASS.

```bash
git add src/components/panels/DeviceInspectorDrawer.vue src/components/panels/DeviceInspectorDrawer.spec.ts
git commit -m "feat: replace equipment modal with inspector drawer"
```

## Task 7: Assemble the Responsive Command-Center Layout

**Files:**

- Modify: `src/views/DashboardView.vue`
- Modify: `src/components/three/EnergyTwinScene.vue`
- Delete: old layout and panel files listed in the file map.

- [ ] **Step 1: Replace the page structure**

Replace the template in `src/views/DashboardView.vue` with:

```vue
<template>
  <main class="dashboard-shell">
    <CommandHeader class="dashboard-shell__header" />
    <SupplyRail class="dashboard-shell__supply" />
    <EnergyTwinScene class="dashboard-shell__twin" />
    <DispatchRail class="dashboard-shell__dispatch" />
    <AnalyticsDock class="dashboard-shell__analytics" />
    <DeviceInspectorDrawer />
  </main>
</template>
```

Import only those six components and retain the facade lifecycle from plan 1.

- [ ] **Step 2: Implement stable grid areas**

Use this scoped layout in `DashboardView.vue`:

```scss
.dashboard-shell {
  position: relative;
  display: grid;
  grid-template-columns: 286px minmax(560px, 1fr) 342px;
  grid-template-rows: auto minmax(520px, 1fr) auto;
  grid-template-areas:
    'header header header'
    'supply twin dispatch'
    'analytics analytics analytics';
  gap: 1px;
  min-height: 100vh;
  padding: 8px;
  background: var(--line-subtle);
}
.dashboard-shell__header { grid-area: header; }
.dashboard-shell__supply { grid-area: supply; }
.dashboard-shell__twin { grid-area: twin; }
.dashboard-shell__dispatch { grid-area: dispatch; }
.dashboard-shell__analytics { grid-area: analytics; }

@media (max-width: 1440px) {
  .dashboard-shell {
    grid-template-columns: 248px minmax(0, 1fr) 300px;
    grid-template-rows: auto minmax(500px, 62vh) auto;
  }
}
@media (max-width: 1100px) {
  .dashboard-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'header' 'twin' 'supply' 'dispatch' 'analytics';
    grid-template-rows: auto auto auto auto auto;
  }
}
@media (max-width: 720px) {
  .dashboard-shell { padding: 0; }
}
```

- [ ] **Step 3: Stabilize the temporary twin viewport**

In `src/components/three/EnergyTwinScene.vue`, change the root radius to `0`, set `min-height: 520px`, and add:

```scss
@media (max-width: 1100px) {
  .scene-card { height: auto; min-height: 0; aspect-ratio: 16 / 10; }
}
@media (max-width: 720px) {
  .scene-card { aspect-ratio: 4 / 3; }
  .scene-overlay--top { flex-direction: column; }
}
```

Keep the current Three.js behavior until plan 3.

- [ ] **Step 4: Delete components no longer imported**

Delete the old files listed under “Delete after migration”, including the three chart components that were only used by the retired side panels. Confirm with:

```bash
rg "TopHeader|SectionCard|DashboardCommandBar|LeftPanel|RightPanel|BottomPanel|EquipmentDetailModal|FocusPanelModal|GenerationTrendChart|LoadTrendChart|EnergyMixChart" src
```

Expected: no import or template references remain.

- [ ] **Step 5: Run the complete UI milestone verification**

Run:

```bash
npm test
npm run type-check
npm run build
```

Expected: all tests pass, build passes, and ECharts is no longer imported from the full `echarts` entry.

- [ ] **Step 6: Commit the assembled UI**

```bash
git add src/views/DashboardView.vue src/components src/charts
git commit -m "feat: assemble responsive energy command center"
```

## Task 8: Verify the UI Milestone Manually

**Files:**

- No source changes expected.

- [ ] **Step 1: Start the development server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL and stays running.

- [ ] **Step 2: Check the three target viewport classes**

At 1920×1080, confirm all three columns and the analytics dock fit without overlap. At 1440×900, confirm labels and controls do not clip. At 390×844, confirm the order is header, twin, supply, dispatch, analytics and there is no horizontal scroll.

- [ ] **Step 3: Check all core workflows**

Confirm:

- Four scenario buttons update all visible metrics.
- The timeline seeks, plays, pauses, and changes speed.
- Clicking a zone or alert opens the correct inspector.
- Only one analytics tab is mounted at a time.
- Escape closes the inspector.
- The current Three.js scene remains visible and interactive.

- [ ] **Step 4: Stop the server and confirm a clean worktree**

Send `Ctrl-C`, then run:

```bash
git status --short
```

Expected: empty output.
