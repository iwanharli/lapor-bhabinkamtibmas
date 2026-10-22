'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useEffect, useState } from 'react';

/** Palet kategori yang terbaca di tema terang maupun gelap. */
export const SERIES_COLORS = ['#6b4423', '#c9a227', '#0f6f9e', '#c2650a', '#8e3b46', '#15803d', '#a8998a'];

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(m.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return dark;
}

export function EChart({ option, height = 280 }: { option: EChartsOption; height?: number }) {
  const dark = useDark();
  const text = dark ? '#b3a291' : '#7a6858';
  const line = dark ? '#3a2d22' : '#ebe3d6';
  const themed: EChartsOption = {
    color: SERIES_COLORS,
    textStyle: { fontFamily: 'inherit', color: text },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: dark ? '#211912' : '#fff', borderColor: line, textStyle: { color: dark ? '#f1e9df' : '#2a1d14' } },
    legend: { top: 0, type: 'scroll', textStyle: { color: text } },
    ...option,
  };
  for (const axis of ['xAxis', 'yAxis'] as const) {
    const a = themed[axis] as Record<string, unknown> | undefined;
    if (a && !Array.isArray(a)) {
      themed[axis] = { axisLine: { lineStyle: { color: line } }, splitLine: { lineStyle: { color: line } }, axisLabel: { color: text }, ...a };
    }
  }
  return <ReactECharts option={themed} style={{ height }} notMerge />;
}
