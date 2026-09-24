# Dashboard One-Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the upgraded campus dashboard fit on one 1920 × 1080 screen at 100% browser zoom without page scrolling, while preserving every detailed view through existing or explicit modal entry points.

**Architecture:** A single `isOneScreenViewport` predicate controls the bottom-panel presentation branch, and matching CSS media conditions constrain the root shell and compact its child panels. The Three.js scene keeps its current component and controls. Small-screen layouts remain unchanged. High-density AI rules get a dedicated detail modal in one-screen mode.

**Tech Stack:** Vue 3 SFC, Pinia, SCSS, Vitest, Three.js, in-app browser visual checks.

---

## Task 1: Establish viewport-mode contract

**Files:** Create `src/layout/oneScreenMode.ts`, `src/layout/oneScreenMode.test.ts`.

- [ ] Write a failing test in `src/layout/oneScreenMode.test.ts` asserting that 1920×1080 and 2560×1440 activate the mode but 1799×1080, 1920×999, and 1440×900 do not:

```ts
import { describe, expect, it } from 'vitest';
import { isOneScreenViewport } from './oneScreenMode';

describe('one-screen viewport', () => {
  it.each([[1920, 1080, true], [2560, 1440, true], [1799, 1080, false], [1920, 999, false], [1440, 900, false]])(
    '%i × %i activates: %s', (width, height, expected) => {
      expect(isOneScreenViewport(width, height)).toBe(expected);
    },
  );
});
```

- [ ] Run `npm test -- src/layout/oneScreenMode.test.ts`; observe a missing-module failure.
- [ ] Implement `src/layout/oneScreenMode.ts`:

```ts
export const ONE_SCREEN_MIN_WIDTH = 1800;
export const ONE_SCREEN_MIN_HEIGHT = 1000;
export const isOneScreenViewport = (width: number, height: number) =>
  width >= ONE_SCREEN_MIN_WIDTH && height >= ONE_SCREEN_MIN_HEIGHT;
```

- [ ] Run the targeted test and `npm run type-check`; commit both files with `feat: define one-screen viewport mode`.

## Task 2: Replace dense bottom charts with an analysis dock in one-screen mode

**Files:** Modify `src/components/panels/BottomPanel.vue`; create `src/oneScreenPresentation.test.ts`.

- [ ] Write a failing source-template regression test asserting `BottomPanel.vue?raw` contains `v-else-if="oneScreenMode"`, a six-button `bottom-panel-screen` dock, and the six pre-existing modal assignments (`power`, `thermalLoad`, `thermalStorage`, `saving`, `revenue`, `timeline`).
- [ ] Run `npm test -- src/oneScreenPresentation.test.ts`; observe a failing assertion for the absent one-screen branch.
- [ ] Add the branch between the current desktop charts and compact mobile panel:

```vue
<nav v-else-if="oneScreenMode" class="bottom-panel-screen glass-card" aria-label="分析模块快捷入口">
  <strong>分析中心</strong>
  <button type="button" class="panel-action-btn" @click="activePanel = 'power'">电功率趋势</button>
  <button type="button" class="panel-action-btn" @click="activePanel = 'thermalLoad'">热负荷趋势</button>
  <button type="button" class="panel-action-btn" @click="activePanel = 'thermalStorage'">水蓄能趋势</button>
  <button type="button" class="panel-action-btn" @click="activePanel = 'saving'">碳与峰值分析</button>
  <button type="button" class="panel-action-btn" @click="activePanel = 'revenue'">移峰节费分析</button>
  <button type="button" class="panel-action-btn" @click="activePanel = 'timeline'">AI 决策时间轴</button>
</nav>
```

- [ ] Replace the old single media-query listener with a `resize` sync using `isOneScreenViewport(window.innerWidth, window.innerHeight)`. Set `desktopAnalysisVisible` only when width is above 1440 and one-screen mode is false. Add/remove the listener in `onMounted`/`onBeforeUnmount`. Give the dock `display:flex`, one-line buttons, 54–60px height, and no wrap at ≥1800px.
- [ ] Run targeted test and type-check; commit with `feat: add one-screen analysis dock`.

## Task 3: Constrain the shell and compact information hierarchy

**Files:** Modify `src/views/DashboardView.vue`, `src/components/layout/TopHeader.vue`, `src/components/panels/LeftPanel.vue`, `src/components/panels/RightPanel.vue`, `src/components/panels/ThermalStoragePanel.vue`, `src/components/panels/AiDecisionPanel.vue`; extend `src/oneScreenPresentation.test.ts`.

- [ ] Start Vite on an available port and use the browser at 1920×1080 before changes. Record `document.documentElement.scrollHeight`, `scrollWidth`, the scene bounding rectangle and the bottom-panel bounding rectangle; the page must demonstrably fail the one-screen contract before the CSS fix.
- [ ] Extend the source-template regression test to require `.dashboard-shell` with `height: 100dvh`, `grid-template-rows: auto minmax(0, 1fr) auto`, and an explicit ≥1800×1000 media block, plus an AI detail button and `FocusPanelModal`.
- [ ] Run the targeted test and observe its expected failure.
- [ ] Add the large-screen media block to `DashboardView.vue`, retaining existing smaller breakpoints:

```scss
@media (min-width: 1800px) and (min-height: 1000px) {
  .dashboard-shell {
    height: 100dvh;
    min-height: 0;
    padding: 10px;
    gap: 10px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
  }
  .dashboard-main { min-height: 0; overflow: hidden; }
  .dashboard-main__left,
  .dashboard-main__right,
  .dashboard-main__scene { min-height: 0; }
}
```

- [ ] In `TopHeader.vue`, use the same media condition to set `grid-template-columns: 300px minmax(0, 1fr) 500px`, `gap: 8px`, `padding: 10px 14px`, KPI padding `6px 10px` and value font `20px`. Keep all four KPIs and scenario controls; render long summary on one ellipsized line, while the status line stays visible.
- [ ] In `LeftPanel.vue`, use `grid-template-rows: 1fr 1fr 0.78fr` and compact metric padding/gaps to fit the PV, weather, and small generation chart without internal scroll. In `RightPanel.vue`, use three minmax rows of approximately equal height and hide only the inline `.load-chart` in this mode because the thermal-load analysis dock opens its full graph. In `ThermalStoragePanel.vue`, tighten metric cells to `6px 8px`, `gap: 5px` so all storage values and the detail button remain visible. Set child `SectionCard` padding to `10px` through the corresponding component's media rule, without modifying normal breakpoints.
- [ ] In `AiDecisionPanel.vue`, add a one-screen-only `查看策略规则` button and `FocusPanelModal` using the existing `ai.strategyRules` data. Hide the inline rule grid only in one-screen mode; the modal presents all original rule descriptions and outcome metrics. Keep existing inline rules in normal desktop/mobile layout. Use this state and entry point:

```vue
<button class="ai-detail-trigger panel-action-btn" type="button" @click="showRules = true">查看策略规则</button>
<FocusPanelModal :visible="showRules" title="AI 策略规则" eyebrow="AI DISPATCH" :description="ai.summary" @close="showRules = false">
  <div class="rule-list rule-list--modal">
    <article v-for="rule in ai.strategyRules" :key="rule.id" class="rule-card">
      <div class="rule-card__head"><h5>{{ rule.title }}</h5><span>{{ rule.score }}分</span></div>
      <div class="rule-track"><div class="rule-track__bar" :style="{ width: `${rule.score}%` }"></div></div>
      <p>{{ rule.description }}</p>
      <footer><span>峰值优化 {{ rule.expectedSavingPct.toFixed(1) }}%</span><span>收益 ¥{{ rule.expectedBenefitCny }}</span></footer>
    </article>
  </div>
</FocusPanelModal>
```

```ts
import { computed, ref } from 'vue';
import FocusPanelModal from '@/components/common/FocusPanelModal.vue';
const showRules = ref(false);
```
- [ ] Run targeted test, full tests and type-check; commit with `feat: fit dashboard summaries around scene`.

## Task 4: Browser acceptance and production verification

**Files:** Fix only files implicated by observed failures.

- [ ] At 1920×1080/100%, read DOM measurements and require `scrollHeight <= innerHeight + 1` and `scrollWidth <= innerWidth + 1`. Visually inspect header, all three main columns and bottom dock for clipping; verify scene canvas remains substantial and aligned.
- [ ] Click all six dock buttons and close their modals. Switch cooling/heating, scene modes and 3D focus; recheck the no-scroll measurements and browser console.
- [ ] At 1440×900 and 390×844, confirm natural responsive scrolling remains and no horizontal overflow is introduced. Reset the temporary viewport override.
- [ ] Run `npm test`, `npm run type-check`, `npm run build`, and `git diff --check`; confirm `git status --short` shows only intended files before committing any fixes.
- [ ] Review the final diff against `docs/superpowers/specs/2026-09-24-dashboard-one-screen-design.md`; do not merge, push or publish without a separate integration decision.
