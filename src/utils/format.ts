export const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatPercent = (value: number, digits = 1) => `${formatNumber(value, digits)}%`;
export const formatCurrency = (value: number, digits = 0) => `¥${formatNumber(value, digits)}`;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
