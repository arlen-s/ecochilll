# Mock Simulation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested, deterministic Mock simulation timeline and split dashboard, twin, and presentation state without breaking the current UI.

**Architecture:** Add a pure timeline domain module, then wrap it in three focused Pinia stores. Keep `useDashboardStore` as a compatibility facade until the command-center UI migrates, so every commit leaves the current application buildable.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vue Test Utils, jsdom

---

## Execution Order

This is plan 1 of 4. Execute it before:

1. `2026-07-28-command-center-ui.md`
2. `2026-07-28-three-digital-twin.md`
3. `2026-07-28-integration-performance-qa.md`

Run implementation in a dedicated `codex/ui-digital-twin-redesign` worktree. Do not change the approved design document during implementation.

## File Map

**Create:**

- `vitest.config.ts` — unit-test environment and aliases.
- `src/test/setup.ts` — deterministic browser API stubs.
- `src/simulation/timeline.ts` — pure minute-based timeline calculations.
- `src/simulation/timeline.spec.ts` — timeline boundary tests.
- `src/store/simulation.ts` — Mock data, time, playback, and derived snapshots.
- `src/store/simulation.spec.ts` — simulation store tests with fake timers.
- `src/store/twin.ts` — selected device, camera focus, and inspector state.
- `src/store/twin.spec.ts` — selection/focus tests.
- `src/store/presentation.ts` — deterministic chapter playback.
- `src/store/presentation.spec.ts` — chapter scheduling tests.

**Modify:**

- `package.json` — test scripts and dev dependencies.
- `package-lock.json` — locked test dependencies.
- `src/types/energy.ts` — simulation speed and playback types.
- `src/store/dashboard.ts` — compatibility facade over the focused stores.
- `src/views/DashboardView.vue` — start and stop the new facade lifecycle.

## Task 1: Establish the Unit-Test Baseline

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install the test dependencies**

Run:

```bash
npm install --save-dev vitest@^3.2.4 @vue/test-utils@^2.4.6 jsdom@^26.1.0
```

Expected: `package.json` and `package-lock.json` include all three packages and npm exits with code 0.

- [ ] **Step 2: Add the test scripts**

Add these entries to `package.json` under `scripts`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run"
}
```

- [ ] **Step 3: Add the Vitest configuration**

Create `vitest.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

- [ ] **Step 4: Add deterministic DOM stubs**

Create `src/test/setup.ts`:

```ts
import { vi } from 'vitest';

class ResizeObserverStub implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(performance.now()), 16),
);
vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
```

- [ ] **Step 5: Verify the empty test suite and current build**

Run:

```bash
npm test -- --passWithNoTests
npm run build
```

Expected: both commands exit with code 0; the build may still report the existing large-chunk warning.

- [ ] **Step 6: Commit the test baseline**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts
git commit -m "test: add unit test baseline"
```

## Task 2: Implement Pure Timeline Calculations

**Files:**

- Modify: `src/types/energy.ts`
- Create: `src/simulation/timeline.ts`
- Create: `src/simulation/timeline.spec.ts`

- [ ] **Step 1: Write the failing timeline tests**

Create `src/simulation/timeline.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  advanceSimulationMinute,
  formatSimulationTime,
  getSimulationHourIndex,
  normalizeSimulationMinute,
} from './timeline';

describe('simulation timeline', () => {
  it('normalizes minutes into a 24-hour day', () => {
    expect(normalizeSimulationMinute(1440)).toBe(0);
    expect(normalizeSimulationMinute(-15)).toBe(1425);
  });

  it('advances by the selected deterministic speed', () => {
    expect(advanceSimulationMinute(840, 1)).toBe(855);
    expect(advanceSimulationMinute(840, 2)).toBe(870);
    expect(advanceSimulationMinute(1430, 4)).toBe(50);
  });

  it('maps minutes to the existing hourly Mock series', () => {
    expect(getSimulationHourIndex(839)).toBe(13);
    expect(getSimulationHourIndex(840)).toBe(14);
    expect(formatSimulationTime(845)).toBe('14:05');
  });
});
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

Run:

```bash
npm test -- src/simulation/timeline.spec.ts
```

Expected: FAIL because `src/simulation/timeline.ts` does not exist.

- [ ] **Step 3: Define the simulation speed type**

Append to `src/types/energy.ts`:

```ts
export type SimulationSpeed = 1 | 2 | 4;

export interface SimulationPlaybackState {
  minuteOfDay: number;
  speed: SimulationSpeed;
  playing: boolean;
}
```

- [ ] **Step 4: Implement the pure timeline module**

Create `src/simulation/timeline.ts`:

```ts
import type { SimulationSpeed } from '@/types/energy';

export const MINUTES_PER_DAY = 24 * 60;
export const MINUTES_PER_TICK = 15;
export const SIMULATION_TICK_MS = 1000;

export const normalizeSimulationMinute = (minute: number) =>
  ((Math.trunc(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

export const advanceSimulationMinute = (minute: number, speed: SimulationSpeed) =>
  normalizeSimulationMinute(minute + MINUTES_PER_TICK * speed);

export const getSimulationHourIndex = (minute: number) =>
  Math.floor(normalizeSimulationMinute(minute) / 60);

export const formatSimulationTime = (minute: number) => {
  const normalized = normalizeSimulationMinute(minute);
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const minutes = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};
```

- [ ] **Step 5: Run the focused tests and type check**

Run:

```bash
npm test -- src/simulation/timeline.spec.ts
npm run type-check
```

Expected: three timeline tests pass and TypeScript exits with code 0.

- [ ] **Step 6: Commit the timeline domain**

```bash
git add src/types/energy.ts src/simulation/timeline.ts src/simulation/timeline.spec.ts
git commit -m "feat: add deterministic simulation timeline"
```

## Task 3: Build the Simulation Store

**Files:**

- Create: `src/store/simulation.ts`
- Create: `src/store/simulation.spec.ts`

- [ ] **Step 1: Write the failing store tests**

Create `src/store/simulation.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulationStore } from './simulation';

describe('simulation store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it('seeks and derives one coherent snapshot', () => {
    const store = useSimulationStore();
    store.seek(19 * 60 + 30);
    expect(store.hourIndex).toBe(19);
    expect(store.timeLabel).toBe('19:30');
    expect(store.liveSnapshot.hourLabel).toBe('19:00');
    expect(store.activeAlerts.every((alert) => Boolean(alert.nodeId))).toBe(true);
  });

  it('advances only while playing and visible', () => {
    const store = useSimulationStore();
    store.start();
    store.play();
    vi.advanceTimersByTime(1000);
    expect(store.minuteOfDay).toBe(855);
    store.setPageVisible(false);
    vi.advanceTimersByTime(1000);
    expect(store.minuteOfDay).toBe(855);
    store.stop();
  });

  it('switches scenarios without random data drift', () => {
    const store = useSimulationStore();
    store.setScenario('cloudy');
    const first = store.liveSnapshot.photovoltaic.powerKw;
    store.setScenario('normal');
    store.setScenario('cloudy');
    expect(store.liveSnapshot.photovoltaic.powerKw).toBe(first);
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
npm test -- src/store/simulation.spec.ts
```

Expected: FAIL because `useSimulationStore` does not exist.

- [ ] **Step 3: Implement the simulation store**

Create `src/store/simulation.ts`:

```ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  buildRuntimeMeta,
  buildScenarioData,
  buildSystemAlerts,
  deriveLiveSnapshot,
} from '@/mock/energyMock';
import {
  advanceSimulationMinute,
  formatSimulationTime,
  getSimulationHourIndex,
  normalizeSimulationMinute,
  SIMULATION_TICK_MS,
} from '@/simulation/timeline';
import type { ScenarioMode, SimulationSpeed } from '@/types/energy';

export const useSimulationStore = defineStore('simulation', () => {
  const scenario = ref<ScenarioMode>('normal');
  const minuteOfDay = ref(14 * 60);
  const speed = ref<SimulationSpeed>(1);
  const playing = ref(false);
  const pageVisible = ref(true);
  const currentTime = ref(new Date());
  const loadError = ref('');
  const scenarioData = ref(buildScenarioData(scenario.value));
  const runtimeMeta = ref(buildRuntimeMeta('mock'));
  let timer: number | undefined;

  const hourIndex = computed(() => getSimulationHourIndex(minuteOfDay.value));
  const timeLabel = computed(() => formatSimulationTime(minuteOfDay.value));
  const liveSnapshot = computed(() => deriveLiveSnapshot(scenarioData.value, hourIndex.value));
  const activeAlerts = computed(() =>
    buildSystemAlerts(scenarioData.value, liveSnapshot.value, hourIndex.value),
  );

  const setScenario = (mode: ScenarioMode) => {
    scenario.value = mode;
    scenarioData.value = buildScenarioData(mode);
    runtimeMeta.value = { ...buildRuntimeMeta('mock'), lastUpdated: new Date().toISOString() };
  };
  const seek = (minute: number) => { minuteOfDay.value = normalizeSimulationMinute(minute); };
  const setSpeed = (value: SimulationSpeed) => { speed.value = value; };
  const play = () => { playing.value = true; };
  const pause = () => { playing.value = false; };
  const toggle = () => { playing.value = !playing.value; };
  const setPageVisible = (value: boolean) => { pageVisible.value = value; };
  const tick = () => {
    currentTime.value = new Date();
    if (playing.value && pageVisible.value) {
      minuteOfDay.value = advanceSimulationMinute(minuteOfDay.value, speed.value);
    }
  };
  const start = () => {
    if (timer !== undefined) return;
    timer = window.setInterval(tick, SIMULATION_TICK_MS);
  };
  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
  };

  return {
    scenario,
    minuteOfDay,
    speed,
    playing,
    pageVisible,
    currentTime,
    loadError,
    scenarioData,
    runtimeMeta,
    hourIndex,
    timeLabel,
    liveSnapshot,
    activeAlerts,
    setScenario,
    seek,
    setSpeed,
    play,
    pause,
    toggle,
    setPageVisible,
    start,
    stop,
  };
});
```

- [ ] **Step 4: Run tests and verify timer cleanup**

Run:

```bash
npm test -- src/store/simulation.spec.ts
```

Expected: three tests pass with no pending timer warning.

- [ ] **Step 5: Commit the simulation store**

```bash
git add src/store/simulation.ts src/store/simulation.spec.ts
git commit -m "feat: add controllable mock simulation store"
```

## Task 4: Build the Twin Interaction Store

**Files:**

- Create: `src/store/twin.ts`
- Create: `src/store/twin.spec.ts`

- [ ] **Step 1: Write the failing selection tests**

Create `src/store/twin.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTwinStore } from './twin';

describe('twin store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it.each([
    ['pv', 'pv'],
    ['ac', 'ac'],
    ['storage', 'storage'],
    ['building-a', 'overview'],
    ['grid', 'overview'],
  ] as const)('maps %s to the %s focus', (nodeId, focus) => {
    const store = useTwinStore();
    store.selectNode(nodeId);
    expect(store.focus).toBe(focus);
  });

  it('opens and closes the inspector explicitly', () => {
    const store = useTwinStore();
    store.selectNode('storage', { openInspector: true });
    expect(store.inspectorVisible).toBe(true);
    store.closeInspector();
    expect(store.inspectorVisible).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
npm test -- src/store/twin.spec.ts
```

Expected: FAIL because `useTwinStore` does not exist.

- [ ] **Step 3: Implement the twin store**

Create `src/store/twin.ts`:

```ts
import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { FocusView } from '@/types/energy';

const focusForNode = (nodeId: string): FocusView => {
  if (nodeId === 'pv' || nodeId === 'ac' || nodeId === 'storage') return nodeId;
  return 'overview';
};

export const useTwinStore = defineStore('twin', () => {
  const focus = ref<FocusView>('overview');
  const selectedNodeId = ref('pv');
  const inspectorVisible = ref(false);

  const setFocus = (value: FocusView) => { focus.value = value; };
  const selectNode = (id: string, options: { openInspector?: boolean } = {}) => {
    selectedNodeId.value = id;
    focus.value = focusForNode(id);
    if (options.openInspector) inspectorVisible.value = true;
  };
  const openInspector = (id?: string) => {
    if (id) selectNode(id);
    inspectorVisible.value = true;
  };
  const closeInspector = () => { inspectorVisible.value = false; };

  return {
    focus,
    selectedNodeId,
    inspectorVisible,
    setFocus,
    selectNode,
    openInspector,
    closeInspector,
  };
});
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npm test -- src/store/twin.spec.ts
```

Expected: all parameterized focus cases and inspector tests pass.

- [ ] **Step 5: Commit the twin store**

```bash
git add src/store/twin.ts src/store/twin.spec.ts
git commit -m "refactor: isolate twin interaction state"
```

## Task 5: Build Deterministic Presentation Playback

**Files:**

- Create: `src/store/presentation.ts`
- Create: `src/store/presentation.spec.ts`

- [ ] **Step 1: Write the failing presentation tests**

Create `src/store/presentation.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresentationStore } from './presentation';
import { useSimulationStore } from './simulation';
import { useTwinStore } from './twin';

describe('presentation store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it('applies chapter scenario, time, focus, and node atomically', () => {
    const presentation = usePresentationStore();
    const simulation = useSimulationStore();
    const twin = useTwinStore();
    presentation.goToChapter(1);
    expect(simulation.scenario).toBe(presentation.currentChapter?.scenario);
    expect(simulation.minuteOfDay).toBe((presentation.currentChapter?.hourIndex ?? 0) * 60);
    expect(twin.selectedNodeId).toBe(presentation.currentChapter?.nodeId);
    expect(twin.focus).toBe(presentation.currentChapter?.focus);
  });

  it('advances after the exact chapter duration', () => {
    const presentation = usePresentationStore();
    presentation.start();
    const duration = presentation.currentChapter?.durationMs ?? 0;
    vi.advanceTimersByTime(duration);
    expect(presentation.currentChapterIndex).toBe(1);
    presentation.stop();
  });

  it('preserves remaining duration and progress while paused', () => {
    const presentation = usePresentationStore();
    presentation.start();
    vi.advanceTimersByTime(1000);
    presentation.pause();
    const pausedProgress = presentation.progressPct;
    vi.advanceTimersByTime(3000);
    expect(presentation.progressPct).toBe(pausedProgress);
    presentation.resume();
    vi.advanceTimersByTime(500);
    expect(presentation.progressPct).toBeGreaterThan(pausedProgress);
    presentation.stop();
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
npm test -- src/store/presentation.spec.ts
```

Expected: FAIL because `usePresentationStore` does not exist.

- [ ] **Step 3: Implement presentation playback**

Create `src/store/presentation.ts`:

```ts
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { buildPresentationScript } from '@/mock/energyMock';
import { useSimulationStore } from './simulation';
import { useTwinStore } from './twin';

export const usePresentationStore = defineStore('presentation', () => {
  const simulation = useSimulationStore();
  const twin = useTwinStore();
  const chapters = ref(buildPresentationScript());
  const currentChapterIndex = ref(0);
  const active = ref(false);
  const paused = ref(false);
  const progressPct = ref(0);
  let chapterTimer: number | undefined;
  let progressTimer: number | undefined;
  let chapterStartedAt = 0;
  let remainingMs = 0;

  const currentChapter = computed(() => chapters.value[currentChapterIndex.value] ?? null);
  const clearTimers = () => {
    if (chapterTimer !== undefined) window.clearTimeout(chapterTimer);
    if (progressTimer !== undefined) window.clearInterval(progressTimer);
    chapterTimer = undefined;
    progressTimer = undefined;
  };
  const refreshProgress = () => {
    const chapter = currentChapter.value;
    if (!chapter || paused.value || !chapterStartedAt) return;
    const completedBeforeRun = chapter.durationMs - remainingMs;
    const elapsed = Date.now() - chapterStartedAt;
    progressPct.value = Math.min(100, ((completedBeforeRun + elapsed) / chapter.durationMs) * 100);
  };
  const schedule = (durationMs = remainingMs) => {
    clearTimers();
    const chapter = currentChapter.value;
    if (!chapter || paused.value || durationMs <= 0) return;
    remainingMs = durationMs;
    chapterStartedAt = Date.now();
    progressTimer = window.setInterval(refreshProgress, 100);
    chapterTimer = window.setTimeout(() => next(), durationMs);
  };
  const goToChapter = (index: number) => {
    const chapter = chapters.value[index];
    if (!chapter) { stop(); return; }
    currentChapterIndex.value = index;
    active.value = true;
    paused.value = false;
    progressPct.value = 0;
    simulation.pause();
    simulation.setScenario(chapter.scenario);
    simulation.seek(chapter.hourIndex * 60);
    twin.selectNode(chapter.nodeId);
    twin.setFocus(chapter.focus);
    remainingMs = chapter.durationMs;
    schedule(chapter.durationMs);
  };
  const start = () => goToChapter(0);
  const next = () => {
    const nextIndex = currentChapterIndex.value + 1;
    if (nextIndex >= chapters.value.length) { stop(); progressPct.value = 100; return; }
    goToChapter(nextIndex);
  };
  const pause = () => {
    if (!active.value || paused.value) return;
    refreshProgress();
    remainingMs = Math.max(0, remainingMs - (Date.now() - chapterStartedAt));
    paused.value = true;
    clearTimers();
  };
  const resume = () => { if (!active.value || !paused.value) return; paused.value = false; schedule(remainingMs); };
  const toggle = () => { if (!active.value) start(); else if (paused.value) resume(); else pause(); };
  const stop = () => {
    active.value = false;
    paused.value = false;
    chapterStartedAt = 0;
    remainingMs = 0;
    clearTimers();
  };

  return {
    chapters,
    currentChapterIndex,
    currentChapter,
    active,
    paused,
    progressPct,
    goToChapter,
    start,
    next,
    pause,
    resume,
    toggle,
    stop,
  };
});
```

- [ ] **Step 4: Run focused and full unit tests**

Run:

```bash
npm test -- src/store/presentation.spec.ts
npm test
```

Expected: presentation tests pass and the full suite is green.

- [ ] **Step 5: Commit presentation playback**

```bash
git add src/store/presentation.ts src/store/presentation.spec.ts
git commit -m "refactor: isolate presentation playback"
```

## Task 6: Convert Dashboard Store into a Compatibility Facade

**Files:**

- Modify: `src/store/dashboard.ts`
- Modify: `src/views/DashboardView.vue`

- [ ] **Step 1: Add a facade contract test**

Append to `src/store/simulation.spec.ts`:

```ts
import { useDashboardStore } from './dashboard';

it('keeps the dashboard facade synchronized with focused stores', () => {
  const dashboard = useDashboardStore();
  dashboard.setScenario('peakPricing');
  dashboard.seek(19 * 60);
  dashboard.selectNode('storage', { openDetail: true });
  expect(dashboard.scenario).toBe('peakPricing');
  expect(dashboard.liveHourIndex).toBe(19);
  expect(dashboard.selectedNodeId).toBe('storage');
  expect(dashboard.detailVisible).toBe(true);
});
```

- [ ] **Step 2: Run the contract test and confirm failure**

Run:

```bash
npm test -- src/store/simulation.spec.ts
```

Expected: FAIL because the current dashboard store has no `seek` action and does not compose the focused stores.

- [ ] **Step 3: Replace timer and primary state ownership in the facade**

In `src/store/dashboard.ts`, keep the existing `selectedNode`, `selectedNodeDetail`, metric, preview, and recommendation computations, but source state from the focused stores:

```ts
import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { usePresentationStore } from './presentation';
import { useSimulationStore } from './simulation';
import { useTwinStore } from './twin';

export const useDashboardStore = defineStore('dashboard', () => {
  const simulation = useSimulationStore();
  const twin = useTwinStore();
  const presentation = usePresentationStore();
  const simulationRefs = storeToRefs(simulation);
  const twinRefs = storeToRefs(twin);
  const presentationRefs = storeToRefs(presentation);

  const {
    scenario,
    currentTime,
    scenarioData,
    runtimeMeta,
    liveSnapshot,
    activeAlerts,
    loadError,
  } = simulationRefs;
  const { focus, selectedNodeId, inspectorVisible } = twinRefs;
  const { currentChapterIndex, currentChapter } = presentationRefs;
  const liveHourIndex = computed(() => simulationRefs.hourIndex.value);
  const detailVisible = inspectorVisible;
  const presentationChapters = presentationRefs.chapters;
  const presentationActive = presentationRefs.active;
  const presentationPaused = presentationRefs.paused;
  const presentationProgressPct = presentationRefs.progressPct;

  // Keep selected-node detail as a read-only projection across simulation
  // and twin state; it owns no timers or mutable source data.

  return {
    ...simulationRefs,
    ...twinRefs,
    ...presentationRefs,
    scenario,
    currentTime,
    scenarioData,
    runtimeMeta,
    liveSnapshot,
    activeAlerts,
    loadError,
    focus,
    selectedNodeId,
    currentChapterIndex,
    currentChapter,
    selectedNode,
    selectedNodeDetail,
    liveHourIndex,
    detailVisible,
    presentationChapters,
    presentationActive,
    presentationPaused,
    presentationProgressPct,
    initialize: async () => undefined,
    start: simulation.start,
    stop: () => { simulation.stop(); presentation.stop(); },
    seek: simulation.seek,
    setScenario: simulation.setScenario,
    setFocus: twin.setFocus,
    selectNode: (id: string, options: { openDetail?: boolean } = {}) =>
      twin.selectNode(id, { openInspector: options.openDetail }),
    openDetail: twin.openInspector,
    closeDetail: twin.closeInspector,
    startPresentation: presentation.start,
    restartPresentation: presentation.start,
    nextPresentationChapter: presentation.next,
    pausePresentation: presentation.pause,
    resumePresentation: presentation.resume,
    togglePresentation: presentation.toggle,
    focusAlert: (alert: SystemAlert) => twin.selectNode(alert.nodeId, { openInspector: true }),
  };
});
```

Keep `SystemAlert` in the existing type imports so the compatibility `focusAlert` signature remains identical to the current store.

Do not retain the old interval or timeout variables after the new stores own them. Place the existing implementations of `selectedNode`, `selectedNodeDetail`, `buildPreviewSeries`, `buildNodeMetrics`, and `buildNodeRecommendation` between the aliases and the `return` block. Because the aliases retain the names `scenarioData`, `liveSnapshot`, `activeAlerts`, and `selectedNodeId`, those computations require no behavioral changes.

- [ ] **Step 4: Keep view lifecycle idempotent**

Retain this lifecycle in `src/views/DashboardView.vue`:

```ts
onMounted(async () => {
  await store.initialize();
  store.start();
});

onBeforeUnmount(() => {
  store.stop();
});
```

- [ ] **Step 5: Run facade tests, type check, and build**

Run:

```bash
npm test
npm run type-check
npm run build
```

Expected: all tests pass, type checking succeeds, and the existing UI still builds. The large-chunk warning remains until plan 2.

- [ ] **Step 6: Commit the compatibility facade**

```bash
git add src/store/dashboard.ts src/store/simulation.spec.ts src/views/DashboardView.vue
git commit -m "refactor: compose focused dashboard stores"
```

## Task 7: Verify the Foundation as a Standalone Milestone

**Files:**

- No source changes expected.

- [ ] **Step 1: Run the complete milestone verification**

Run:

```bash
npm test
npm run type-check
npm run build
git status --short
```

Expected:

- Unit tests pass.
- Type checking passes.
- Production build passes.
- Existing dashboard remains available.
- `git status --short` is empty.

- [ ] **Step 2: Record the baseline build output for plan 2**

Run:

```bash
find dist/assets -maxdepth 1 -type f -print
```

Expected: the current CSS and JavaScript artifact names are printed. Copy their minified and gzip sizes from `npm run build` into the implementation handoff note; do not edit the approved design spec.
