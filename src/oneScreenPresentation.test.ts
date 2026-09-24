import { describe, expect, it } from 'vitest';
import bottomPanelSource from '@/components/panels/BottomPanel.vue?raw';

describe('one-screen dashboard presentation', () => {
  it('offers all six analyses from a compact dock', () => {
    const dock = bottomPanelSource.match(/<nav v-else-if="oneScreenMode"[\s\S]*?<\/nav>/)?.[0];
    expect(dock).toBeDefined();
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
});
