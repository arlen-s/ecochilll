import { describe, expect, it } from 'vitest';
import * as energyScene from '@/three/createEnergyScene';
import focusPanelSource from '@/components/common/FocusPanelModal.vue?raw';
import powerTrendSource from '@/components/charts/PowerTrendChart.vue?raw';
import energyTwinSource from '@/components/three/EnergyTwinScene.vue?raw';

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
});
