import { describe, expect, it } from 'vitest';
import bottomPanelSource from '@/components/panels/BottomPanel.vue?raw';
import dashboardSource from '@/views/DashboardView.vue?raw';
import aiPanelSource from '@/components/panels/AiDecisionPanel.vue?raw';
import energyTwinSource from '@/components/three/EnergyTwinScene.vue?raw';
import storagePanelSource from '@/components/panels/ThermalStoragePanel.vue?raw';

describe('one-screen dashboard presentation', () => {
  it('offers all six analyses from a compact dock', () => {
    const dock = bottomPanelSource.match(/<nav v-else-if="oneScreenMode"[\s\S]*?<\/nav>/)?.[0];
    expect(dock).toBeDefined();
    expect(bottomPanelSource).toMatch(/\.bottom-panel-screen\s*\{[^}]*padding-right:\s*190px/s);
    for (const [panel, label] of [
      ['power', '电功率趋势'],
      ['thermalLoad', '热负荷趋势'],
      ['thermalStorage', '水蓄能趋势'],
      ['saving', '碳与峰值分析'],
      ['revenue', '移峰节费分析'],
      ['timeline', 'AI 决策时间轴'],
    ]) {
      expect(dock).toContain(`activePanel = '${panel}'`);
      expect(dock).toContain(label);
    }
  });

  it('constrains the dashboard shell to a large desktop viewport', () => {
    expect(dashboardSource).toMatch(/@media \(min-width: 1800px\) and \(min-height: 1000px\)/);
    expect(dashboardSource).toMatch(/height:\s*100dvh/);
    expect(dashboardSource).toMatch(/grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  });

  it('keeps full AI strategy rules available in a modal', () => {
    expect(aiPanelSource).toContain('查看策略规则');
    expect(aiPanelSource).toContain('<FocusPanelModal');
    expect(aiPanelSource).toContain('ai.strategyRules');
  });

  it('resizes the Three.js renderer when its container changes height', () => {
    expect(energyTwinSource).toContain('ResizeObserver');
    expect(energyTwinSource).toContain('observe(sceneRoot.value)');
  });

  it('keeps secondary storage metrics in the detail view when the one-screen card is compact', () => {
    expect(storagePanelSource).toContain("store.openDetail('storage')");
    expect(storagePanelSource).toMatch(/\.storage-metric:nth-last-child\(-n \+ 4\)\s*\{\s*display:\s*none/);
  });
});
