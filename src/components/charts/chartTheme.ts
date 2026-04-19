import type {
  BarSeriesOption,
  ComposeOption,
  GridComponentOption,
  LegendComponentOption,
  LineSeriesOption,
  PieSeriesOption,
  TooltipComponentOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

export type DashboardChartOption = ComposeOption<
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | XAXisComponentOption
  | YAXisComponentOption
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
>;

export const commonGrid: GridComponentOption = {
  left: 10,
  right: 12,
  top: 28,
  bottom: 16,
  containLabel: true,
};

export const commonAxis = {
  axisLine: {
    lineStyle: {
      color: 'rgba(145, 205, 255, 0.18)',
    },
  },
  axisLabel: {
    color: 'rgba(219, 239, 255, 0.64)',
    fontSize: 11,
  },
  splitLine: {
    lineStyle: {
      color: 'rgba(145, 205, 255, 0.08)',
      type: 'dashed' as const,
    },
  },
};

export const lineSeries = (name: string, color: string, data: number[]): LineSeriesOption => ({
  name,
  type: 'line',
  smooth: true,
  symbol: 'circle',
  symbolSize: 6,
  lineStyle: {
    width: 2,
    color,
  },
  itemStyle: {
    color,
  },
  areaStyle: {
    color: {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: `${color}66` },
        { offset: 1, color: `${color}00` },
      ],
    },
  },
  data,
});

export const tooltipTheme: TooltipComponentOption = {
  trigger: 'axis',
  backgroundColor: 'rgba(7, 18, 35, 0.94)',
  borderColor: 'rgba(61, 225, 255, 0.28)',
  textStyle: {
    color: '#e6f7ff',
  },
};

export const pieSeries = (data: PieSeriesOption['data']): PieSeriesOption => ({
  type: 'pie',
  radius: ['58%', '76%'],
  center: ['50%', '52%'],
  label: {
    color: 'rgba(219, 239, 255, 0.78)',
    formatter: '{b|{b}}\n{c|{c}%}',
    rich: {
      b: { fontSize: 11, color: 'rgba(219, 239, 255, 0.68)' },
      c: { fontSize: 14, fontWeight: 700, color: '#ffffff' },
    },
  },
  labelLine: {
    lineStyle: {
      color: 'rgba(145, 205, 255, 0.3)',
    },
  },
  itemStyle: {
    borderColor: 'rgba(3, 12, 27, 1)',
    borderWidth: 4,
  },
  data,
});
