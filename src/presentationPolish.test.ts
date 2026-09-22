import { describe, expect, it } from 'vitest';
import * as energyScene from '@/three/createEnergyScene';
import focusPanelSource from '@/components/common/FocusPanelModal.vue?raw';
import powerTrendSource from '@/components/charts/PowerTrendChart.vue?raw';
import revenueTrendSource from '@/components/charts/RevenueTrendChart.vue?raw';
import rightPanelSource from '@/components/panels/RightPanel.vue?raw';
import energyTwinSource from '@/components/three/EnergyTwinScene.vue?raw';
import topHeaderSource from '@/components/layout/TopHeader.vue?raw';
import energySceneSource from '@/three/createEnergyScene.ts?raw';

describe('presentation polish regressions', () => {
  it('reserves a scrollable legend area above the electrical chart plot', () => {
    expect(powerTrendSource).toContain("type: 'scroll'");
    expect(powerTrendSource).toMatch(/grid:\s*\{[\s\S]*top:\s*58/);
  });

  it('exposes dialog semantics and managed modal focus behavior', () => {
    expect(focusPanelSource).toContain('role="dialog"');
    expect(focusPanelSource).toContain('aria-modal="true"');
    expect(focusPanelSource).toContain(':aria-labelledby="titleId"');
    expect(focusPanelSource).toContain('trapModalFocus');
    expect(focusPanelSource).toContain('previouslyFocused');
  });

  it('keeps a per-flow phase that advances incrementally', () => {
    const advanceFlowPhase = (energyScene as Record<string, unknown>).advanceFlowPhase;

    expect(advanceFlowPhase).toBeTypeOf('function');
    if (typeof advanceFlowPhase !== 'function') return;

    const advance = advanceFlowPhase as (
      phase: number,
      deltaSeconds: number,
      speed: number,
      visibleFactor: number,
    ) => number;

    const beforeSpeedChange = advance(0.24, 0.5, 0.1, 1);
    const immediatelyAfterSpeedChange = advance(beforeSpeedChange, 0, 0.3, 1);
    const afterNextFrame = advance(immediatelyAfterSpeedChange, 0.5, 0.3, 1);

    expect(immediatelyAfterSpeedChange).toBe(beforeSpeedChange);
    expect(afterNextFrame).toBeCloseTo(beforeSpeedChange + 0.285);
  });

  it('uses separate photovoltaic and grid legend entries matching their flows', () => {
    expect(energyTwinSource).toContain('> 光伏供电</span>');
    expect(energyTwinSource).toContain('> 电网供电</span>');
    expect(energyTwinSource).toContain('legend__dot--grid');
    expect(energyTwinSource).toMatch(/legend__dot--grid\s*\{\s*background:\s*#ff9d7f/);
  });

  it('charts water-storage benefit instead of overall PV plus storage savings', () => {
    expect(revenueTrendSource).toContain('item.storageBenefitCny');
    expect(revenueTrendSource).not.toContain('item.savingCny');
  });

  it('shows seasonal scenario and HVAC labels from the underlying mode-aware data', () => {
    expect(topHeaderSource).toContain("store.operationMode === 'heating' ? '寒潮模式' : '高温模式'");
    expect(rightPanelSource).toContain('live.airConditioning.runningStatus');
    expect(rightPanelSource).not.toContain('displayStatus');
    expect(energySceneSource).toContain("label: '冷热源机房'");
    expect(energySceneSource).not.toContain("label: '空调冷站'");
  });
});
