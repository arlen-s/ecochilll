# Integration, Performance, and Visual QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete resilient degradation, enforce bundle/performance budgets, and prove the redesigned command center works visually across desktop and mobile viewports.

**Architecture:** Add explicit WebGL and asset failure paths, centralize page visibility, then enforce static bundle budgets and browser-level acceptance tests. Deployment remains a static Vite site with all models and effects hosted locally.

**Tech Stack:** Vue 3, Three.js, Vite/Rollup, Vitest, Playwright, PNGJS, Nginx

---

## Execution Order

This is plan 4 of 4. Start only after `2026-07-28-three-digital-twin.md` passes. This plan is the release gate for the full redesign.

## File Map

**Create:**

- `src/three/webglSupport.ts` — injectable WebGL capability detection.
- `src/three/webglSupport.spec.ts`
- `src/components/three/EnergyTopologyFallback.vue` — 2D usable fallback.
- `src/composables/usePageVisibility.ts` — shared visibility lifecycle.
- `src/composables/usePageVisibility.spec.ts`
- `scripts/check-bundle-budget.mjs` — JavaScript and model asset budgets.
- `playwright.config.ts` — desktop/mobile browser matrix.
- `tests/e2e/dashboard.spec.ts` — workflows, layout, canvas pixels, and reduced motion.

**Modify:**

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `src/views/DashboardView.vue`
- `src/components/three/EnergyTwinScene.vue`
- `src/three/core/TwinSceneManager.ts`
- `src/three/types.ts`
- `deploy/159.89.93.140.conf`
- `deploy/ecochill.cn.conf`
- `deploy/ancientherbs.ac.cn.conf`
- `README.md`

## Task 1: Add a Usable WebGL Fallback

**Files:**

- Create: `src/three/webglSupport.ts`
- Create: `src/three/webglSupport.spec.ts`
- Create: `src/components/three/EnergyTopologyFallback.vue`
- Modify: `src/components/three/EnergyTwinScene.vue`

- [ ] **Step 1: Write failing WebGL capability tests**

Create `src/three/webglSupport.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { supportsWebGL } from './webglSupport';

describe('supportsWebGL', () => {
  it('returns true when a WebGL2 context is available', () => {
    const canvas = { getContext: vi.fn().mockReturnValue({}) } as unknown as HTMLCanvasElement;
    expect(supportsWebGL(() => canvas)).toBe(true);
  });

  it('returns false for context failure or exceptions', () => {
    const missing = { getContext: vi.fn().mockReturnValue(null) } as unknown as HTMLCanvasElement;
    expect(supportsWebGL(() => missing)).toBe(false);
    expect(supportsWebGL(() => { throw new Error('blocked'); })).toBe(false);
  });
});
```

- [ ] **Step 2: Implement injectable capability detection**

Create `src/three/webglSupport.ts`:

```ts
export const supportsWebGL = (
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
) => {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};
```

- [ ] **Step 3: Run the tests**

Run:

```bash
npm test -- src/three/webglSupport.spec.ts
```

Expected: three assertions pass.

- [ ] **Step 4: Build the 2D topology fallback**

Create `src/components/three/EnergyTopologyFallback.vue`:

```vue
<template>
  <section class="energy-topology" aria-label="二维能源拓扑">
    <header><span>2D TOPOLOGY</span><strong>{{ simulation.timeLabel }}</strong></header>
    <div class="energy-topology__graph">
      <button class="topology-node topology-node--pv" type="button" @click="open('pv')"><Sun :size="20" /><span>光伏</span><strong>{{ live.photovoltaic.powerKw }} kW</strong></button>
      <button class="topology-node topology-node--storage" type="button" @click="open('storage')"><BatteryCharging :size="20" /><span>储能</span><strong>{{ live.storage.socPct.toFixed(0) }}%</strong></button>
      <button class="topology-node topology-node--ac" type="button" @click="open('ac')"><Fan :size="20" /><span>冷站</span><strong>{{ live.airConditioning.totalLoadKw }} kW</strong></button>
      <button class="topology-node topology-node--grid" type="button" @click="open('grid')"><UtilityPole :size="20" /><span>电网</span><strong>{{ live.gridImportKw }} kW</strong></button>
      <i class="topology-flow topology-flow--pv-ac" />
      <i class="topology-flow topology-flow--pv-storage" />
      <i class="topology-flow topology-flow--storage-ac" />
      <i class="topology-flow topology-flow--grid-ac" />
    </div>
    <p>当前设备不支持 3D 渲染，核心数据与调度控制仍可使用。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BatteryCharging, Fan, Sun, UtilityPole } from 'lucide-vue-next';
import { useSimulationStore } from '@/store/simulation';
import { useTwinStore } from '@/store/twin';
const simulation = useSimulationStore();
const twin = useTwinStore();
const live = computed(() => simulation.liveSnapshot);
const open = (id: string) => twin.selectNode(id, { openInspector: true });
</script>
```

Add these scoped styles:

```scss
.energy-topology { min-height: 100%; padding: 18px; background: var(--surface-1); }
.energy-topology header { display: flex; justify-content: space-between; color: var(--text-secondary); }
.energy-topology__graph {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(82px, 1fr));
  grid-template-rows: repeat(3, minmax(72px, 1fr));
  grid-template-areas: '. pv .' 'storage . ac' '. grid .';
  gap: 18px;
  aspect-ratio: 16 / 10;
  margin: 16px 0;
}
.topology-node {
  z-index: 2;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-active);
  border-radius: var(--panel-radius);
  background: rgba(10, 18, 20, 0.92);
  color: var(--text-primary);
}
.topology-node--pv { grid-area: pv; }
.topology-node--storage { grid-area: storage; }
.topology-node--ac { grid-area: ac; }
.topology-node--grid { grid-area: grid; }
.topology-node span { color: var(--text-secondary); font-size: 11px; }
.topology-flow {
  position: absolute;
  z-index: 1;
  height: 2px;
  transform-origin: left center;
  background: linear-gradient(90deg, transparent, var(--signal-cyan), transparent);
  background-size: 200% 100%;
  animation: topology-flow 1.8s linear infinite;
}
.topology-flow--pv-ac { left: 50%; top: 20%; width: 36%; transform: rotate(38deg); }
.topology-flow--pv-storage { left: 50%; top: 20%; width: 36%; transform: rotate(142deg); }
.topology-flow--storage-ac { left: 20%; top: 50%; width: 60%; }
.topology-flow--grid-ac { left: 50%; top: 80%; width: 36%; transform: rotate(-38deg); }
@keyframes topology-flow { to { background-position: -200% 0; } }
@media (max-width: 720px) { .energy-topology__graph { aspect-ratio: 4 / 3; } }
@media (prefers-reduced-motion: reduce) { .topology-flow { animation: none; } }
```

- [ ] **Step 5: Integrate fallback versus warning state**

In `EnergyTwinScene.vue`, split state:

```ts
const fatalError = ref('');
const sceneWarning = ref('');
const webglAvailable = supportsWebGL();
if (!webglAvailable) fatalError.value = 'WebGL 不可用';
```

Render `<EnergyTopologyFallback v-if="fatalError" />` instead of the scene root. Send partial-model messages from `onError` to `sceneWarning`; only manager construction failure sets `fatalError`. Show warnings as a dismissible status strip over the working canvas.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test -- src/three/webglSupport.spec.ts
npm run type-check
npm run build
```

Expected: all commands pass.

```bash
git add src/three/webglSupport.ts src/three/webglSupport.spec.ts src/components/three/EnergyTopologyFallback.vue src/components/three/EnergyTwinScene.vue
git commit -m "feat: add resilient 2D energy fallback"
```

## Task 2: Pause All Work While the Page Is Hidden

**Files:**

- Create: `src/composables/usePageVisibility.ts`
- Create: `src/composables/usePageVisibility.spec.ts`
- Modify: `src/views/DashboardView.vue`
- Modify: `src/components/three/EnergyTwinScene.vue`
- Modify: `src/three/core/TwinSceneManager.ts`

- [ ] **Step 1: Write the failing composable test**

Create `src/composables/usePageVisibility.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPageVisibilityHandler } from './usePageVisibility';

describe('page visibility', () => {
  it('forwards the current visible state', () => {
    const callback = vi.fn();
    const handler = createPageVisibilityHandler(() => true, callback);
    handler();
    expect(callback).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Implement the composable**

Create `src/composables/usePageVisibility.ts`:

```ts
import { onBeforeUnmount, onMounted } from 'vue';

export const createPageVisibilityHandler = (isHidden: () => boolean, callback: (visible: boolean) => void) =>
  () => callback(!isHidden());

export const usePageVisibility = (callback: (visible: boolean) => void) => {
  const handler = createPageVisibilityHandler(() => document.hidden, callback);
  onMounted(() => {
    document.addEventListener('visibilitychange', handler);
    handler();
  });
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', handler));
};
```

- [ ] **Step 3: Pause the simulation centrally**

In `DashboardView.vue`:

```ts
import { usePageVisibility } from '@/composables/usePageVisibility';
import { useSimulationStore } from '@/store/simulation';
const simulation = useSimulationStore();
usePageVisibility((visible) => simulation.setPageVisible(visible));
```

- [ ] **Step 4: Stop scheduling hidden 3D frames**

Replace `setVisible` and frame scheduling in `TwinSceneManager` with:

```ts
private requestNextFrame() {
  if (!this.disposed && this.visible && this.frame === 0) {
    this.frame = requestAnimationFrame(this.animate);
  }
}
private animate = () => {
  this.frame = 0;
  if (this.disposed || !this.visible) return;
  // render systems exactly once
  this.requestNextFrame();
};
setVisible(visible: boolean) {
  this.visible = visible;
  if (!visible && this.frame) {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.clock.stop();
  } else if (visible) {
    this.clock.start();
    this.requestNextFrame();
  }
}
```

After async initialization call `requestNextFrame()` instead of assigning `requestAnimationFrame` directly.

- [ ] **Step 5: Forward visibility into the scene**

Call `usePageVisibility((visible) => sceneApi?.setVisible(visible))` inside `EnergyTwinScene.vue`. Immediately after `TwinSceneManager.create(...)` resolves, also call:

```ts
sceneApi.setVisible(!document.hidden);
```

This covers the case where the page became hidden before asynchronous GLB loading completed.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- src/composables/usePageVisibility.spec.ts src/store/simulation.spec.ts
npm run type-check
```

Expected: tests pass and no timer remains active after component unmount.

```bash
git add src/composables src/views/DashboardView.vue src/components/three/EnergyTwinScene.vue src/three/core/TwinSceneManager.ts
git commit -m "perf: pause simulation and rendering when hidden"
```

## Task 3: Enforce Code and Asset Budgets

**Files:**

- Modify: `vite.config.ts`
- Create: `scripts/check-bundle-budget.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add stable manual chunk groups**

Add to `vite.config.ts`:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('/node_modules/three/')) return 'vendor-three';
        if (id.includes('/node_modules/echarts/') || id.includes('/node_modules/zrender/')) return 'vendor-charts';
        if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/') || id.includes('/node_modules/pinia/') || id.includes('/node_modules/lucide-vue-next/')) return 'vendor-ui';
        return undefined;
      },
    },
  },
},
```

Keep the existing Vue plugin, alias, and dev-server settings.

- [ ] **Step 2: Create the executable budget check**

Create `scripts/check-bundle-budget.mjs`:

```js
import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const assetsDir = new URL('./assets/', dist);
const files = await readdir(assetsDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const html = await readFile(new URL('./index.html', dist), 'utf8');
const entryName = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entryName) throw new Error('Unable to find the entry JavaScript in dist/index.html');

const gzipSizes = new Map();
for (const file of jsFiles) {
  const source = await readFile(new URL(`./assets/${file}`, dist));
  gzipSizes.set(file, gzipSync(source).byteLength);
}
const entryGzip = gzipSizes.get(entryName) ?? Infinity;
const totalGzip = [...gzipSizes.values()].reduce((sum, size) => sum + size, 0);
const modelDir = new URL('./models/twin/', dist);
const modelFiles = (await readdir(modelDir)).filter((file) => file.endsWith('.glb'));
let totalModels = 0;
for (const file of modelFiles) totalModels += (await stat(new URL(file, modelDir))).size;

const limits = { entryGzip: 180 * 1024, totalGzip: 480 * 1024, totalModels: 4 * 1024 * 1024 };
console.log(JSON.stringify({ entryGzip, totalGzip, totalModels, jsFiles, modelFiles }, null, 2));
if (entryGzip > limits.entryGzip) throw new Error(`Entry gzip budget exceeded: ${entryGzip}`);
if (totalGzip > limits.totalGzip) throw new Error(`Total JavaScript gzip budget exceeded: ${totalGzip}`);
if (totalModels > limits.totalModels) throw new Error(`Twin model budget exceeded: ${totalModels}`);
if (modelFiles.length !== 4) throw new Error(`Expected 4 GLB assets, found ${modelFiles.length}`);
```

- [ ] **Step 3: Add budget and release-verification scripts**

Add to `package.json`:

```json
{
  "check:bundle": "node scripts/check-bundle-budget.mjs",
  "verify": "npm test && npm run type-check && npm run build && npm run check:bundle"
}
```

- [ ] **Step 4: Run the budget gate**

Run:

```bash
npm run build
npm run check:bundle
```

Expected: entry gzip is at most 180 KB, total JavaScript gzip is at most 480 KB, exactly four GLBs exist, and total GLB size is at most 4 MB. If a limit fails, remove unused imports or reduce assets; do not raise the approved limits.

- [ ] **Step 5: Assert legacy charts stayed removed**

Run:

```bash
rg "GenerationTrendChart|LoadTrendChart|EnergyMixChart" src
```

Expected: no matches. The command-center UI plan deletes these files; a match means a later task accidentally reintroduced a retired import and must be corrected before continuing.

- [ ] **Step 6: Commit bundle enforcement**

```bash
git add vite.config.ts scripts/check-bundle-budget.mjs package.json src/components/charts
git commit -m "perf: enforce command center bundle budgets"
```

## Task 4: Add Browser and Canvas-Pixel Tests

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Install browser-test dependencies**

Run:

```bash
npm install --save-dev @playwright/test pngjs @types/pngjs
npx playwright install chromium
```

Expected: packages and Chromium install successfully.

- [ ] **Step 2: Add Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Add canvas and layout helpers**

Start `tests/e2e/dashboard.spec.ts` with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const expectNonBlankCanvas = async (canvas: Locator) => {
  const image = PNG.sync.read(await canvas.screenshot());
  const colors = new Set<string>();
  for (let y = 0; y < image.height; y += Math.max(1, Math.floor(image.height / 30))) {
    for (let x = 0; x < image.width; x += Math.max(1, Math.floor(image.width / 30))) {
      const offset = (image.width * y + x) * 4;
      colors.add(`${image.data[offset]},${image.data[offset + 1]},${image.data[offset + 2]}`);
    }
  }
  expect(colors.size).toBeGreaterThan(24);
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

const expectRegionsDoNotOverlap = async (page: Page) => {
  const selectors = ['.dashboard-shell__header', '.dashboard-shell__supply', '.dashboard-shell__twin', '.dashboard-shell__dispatch', '.dashboard-shell__analytics'];
  const boxes = await Promise.all(selectors.map((selector) => page.locator(selector).boundingBox()));
  const visible = boxes.filter((box): box is NonNullable<typeof box> => Boolean(box));
  for (let left = 0; left < visible.length; left += 1) {
    for (let right = left + 1; right < visible.length; right += 1) {
      const a = visible[left]; const b = visible[right];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(overlapX > 2 && overlapY > 2).toBe(false);
    }
  }
};
```

- [ ] **Step 4: Add the viewport and interaction matrix**

Continue `tests/e2e/dashboard.spec.ts`:

```ts
for (const viewport of [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`${viewport.name} renders without overlap`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.twin-loading')).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('.dashboard-shell__twin canvas')).toBeVisible();
    await expectNonBlankCanvas(page.locator('.dashboard-shell__twin canvas'));
    await expectNoHorizontalOverflow(page);
    await expectRegionsDoNotOverlap(page);
    await page.screenshot({ path: `test-results/${viewport.name}.png`, fullPage: true });
  });
}

test('scenario, timeline, analytics, and inspector stay synchronized', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-scenario="peakPricing"]').click();
  await page.locator('input[aria-label="仿真时间"]').fill('1140');
  await page.locator('[data-tab="revenue"]').click();
  await page.locator('.alert-row').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[data-testid="analytics-dock"]')).toHaveAttribute('data-active-tab', 'revenue');
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toBeHidden();
});

test('does not request external runtime assets', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') external.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('.twin-loading')).toBeHidden({ timeout: 20_000 });
  expect(external).toEqual([]);
});
```

Use `page.locator('input[aria-label="仿真时间"]').evaluate((input) => { input.value = '1140'; input.dispatchEvent(new Event('input', { bubbles: true })); })` instead of `.fill()` if the installed Playwright version rejects filling range inputs.

- [ ] **Step 5: Add the browser-test script and run it**

Add to `package.json`:

```json
{
  "test:e2e": "playwright test"
}
```

Run:

```bash
npm run test:e2e
```

Expected: all viewport, synchronization, and local-asset tests pass; three screenshots are written under `test-results/`.

- [ ] **Step 6: Commit browser coverage**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e/dashboard.spec.ts
git commit -m "test: add digital twin visual acceptance coverage"
```

Do not commit `test-results/`; add it and `playwright-report/` to `.gitignore`.

## Task 5: Prove Reduced Motion, Quality Degradation, and Frame Budgets

**Files:**

- Modify: `src/three/types.ts`
- Modify: `src/three/core/TwinSceneManager.ts`
- Modify: `src/components/three/EnergyTwinScene.vue`
- Modify: `tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Expose the selected quality tier**

Add to `TwinSceneCallbacks` in `src/three/types.ts`:

```ts
onQuality?: (quality: RenderQuality) => void;
onPerformance?: (stats: { fps: number }) => void;
```

Call `callbacks.onQuality?.(this.quality)` in the manager constructor. In `EnergyTwinScene.vue`, add the typed state and callback:

```ts
import type { RenderQuality } from '@/three/types';
const quality = ref<RenderQuality>('low');

// Inside TwinSceneManager.create callbacks:
onQuality: (value) => { quality.value = value; },
```

Bind it to the root:

```vue
<section class="scene-card" :data-quality="quality">
```

- [ ] **Step 2: Report actual rendered frames**

Add these fields to `TwinSceneManager`:

```ts
private framesSinceSample = 0;
private sampleStartedAt = performance.now();
```

Immediately after each renderer or post-processing render call in `animate`:

```ts
this.framesSinceSample += 1;
const sampleElapsed = performance.now() - this.sampleStartedAt;
if (sampleElapsed >= 1000) {
  this.callbacks.onPerformance?.({ fps: Math.round((this.framesSinceSample * 1000) / sampleElapsed) });
  this.framesSinceSample = 0;
  this.sampleStartedAt = performance.now();
}
```

When `setVisible(true)` resumes the manager, reset both sampling fields before requesting a frame so hidden time is not counted as rendering time:

```ts
this.framesSinceSample = 0;
this.sampleStartedAt = performance.now();
```

In `EnergyTwinScene.vue`, expose the latest measurement without visible debug text:

```ts
const renderFps = ref(0);

// Inside TwinSceneManager.create callbacks:
onPerformance: ({ fps }) => { renderFps.value = fps; },
```

```vue
<section class="scene-card" :data-quality="quality" :data-fps="renderFps">
```

- [ ] **Step 3: Add reduced-motion and frame-budget browser tests**

Append to `tests/e2e/dashboard.spec.ts`:

```ts
test('reduced motion selects the low render tier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.scene-card')).toHaveAttribute('data-quality', 'low');
  await expect(page.locator('.dashboard-shell__twin canvas')).toBeVisible();
  await expectNonBlankCanvas(page.locator('.dashboard-shell__twin canvas'));
});

test('meets desktop and mobile frame budgets', async ({ page }) => {
  for (const target of [
    { viewport: { width: 1920, height: 1080 }, minimum: 45 },
    { viewport: { width: 390, height: 844 }, minimum: 28 },
  ]) {
    await page.setViewportSize(target.viewport);
    await page.goto('/');
    await expect.poll(async () => Number(await page.locator('.scene-card').getAttribute('data-fps')), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(target.minimum);
  }
});
```

- [ ] **Step 4: Run focused browser coverage and commit**

Run:

```bash
npm run test:e2e -- --grep "reduced motion|frame budgets"
```

Expected: reduced-motion canvas remains nonblank, desktop headless rendering reaches at least 45 FPS, and mobile low-quality rendering reaches at least 28 FPS. During final manual QA on the target presentation machine, require at least 50 FPS desktop and 30 FPS mobile.

```bash
git add src/three/types.ts src/three/core/TwinSceneManager.ts src/components/three/EnergyTwinScene.vue tests/e2e/dashboard.spec.ts
git commit -m "test: verify adaptive twin quality"
```

## Task 6: Optimize Static Deployment and Documentation

**Files:**

- Modify: `deploy/159.89.93.140.conf`
- Modify: `deploy/ecochill.cn.conf`
- Modify: `deploy/ancientherbs.ac.cn.conf`
- Modify: `README.md`

- [ ] **Step 1: Add compression and model caching**

Add these directives inside each Nginx `server` block:

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml;

location /models/ {
  expires 7d;
  add_header Cache-Control "public, max-age=604800";
  add_header X-Content-Type-Options "nosniff" always;
  try_files $uri =404;
}
```

Also add `add_header X-Content-Type-Options "nosniff" always;` to the existing `/assets/` location. Keep SPA fallback only in `location /`.

- [ ] **Step 2: Correct and expand the README**

In `README.md`:

- Replace all machine-specific `/Volumes/...` links with repository-relative links.
- Replace the old page-structure section with command header, supply rail, twin viewport, dispatch rail, analytics dock, and inspector drawer.
- Document `npm test`, `npm run test:e2e`, `npm run verify`, and `npm run assets:twin`.
- Document the four bundled GLBs and link `public/models/twin/LICENSES.md`.
- State that the current runtime is deterministic Mock data and does not require network access.
- Document the 1920×1080, 1440×900, and 390×844 acceptance viewports.

- [ ] **Step 3: Validate deployment syntax where Nginx is available**

Run:

```bash
nginx -t
```

Expected: PASS on an Nginx host. If Nginx is not installed locally, record that limitation in the handoff and still validate the files visually for duplicate locations and matching braces.

- [ ] **Step 4: Commit deployment and docs**

```bash
git add deploy README.md
git commit -m "docs: update command center deployment guide"
```

## Task 7: Run the Final Release Gate

**Files:**

- No source changes expected unless a gate exposes a defect.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm run verify
npm run test:e2e
```

Expected:

- Unit tests pass.
- Type checking passes.
- Production build passes.
- JavaScript and model budgets pass.
- All Playwright viewport and workflow tests pass.
- Canvas pixel checks pass.

- [ ] **Step 2: Inspect production output**

Run:

```bash
find dist -maxdepth 3 -type f -print
```

Expected: hashed UI, chart, and Three.js chunks; four GLBs; no source GLBs; no externally hosted font or image references.

- [ ] **Step 3: Start the final preview server**

Run:

```bash
npm run preview -- --host 127.0.0.1 --port 4174
```

Expected: preview is available at `http://127.0.0.1:4174`.

- [ ] **Step 4: Perform the final visual review**

At the three target viewports, confirm:

- The brand and energy dispatch purpose are visible in the first viewport.
- 3D models, spatial labels, selective Bloom, scan wave, and energy paths render correctly.
- No text, button, HUD, panel, chart, drawer, or model label overlaps incoherently.
- The interface uses graphite, cold white, cyan, green, amber, and red by semantic role rather than a single blue palette.
- Controls stay stable when values update.
- Mobile content follows KPI, twin, alerts/AI, and detailed-data order.

- [ ] **Step 5: Stop the server and confirm a clean branch**

Send `Ctrl-C`, then run:

```bash
git status --short
git log --oneline --decorate -12
```

Expected: clean status and a readable sequence of focused implementation commits.
