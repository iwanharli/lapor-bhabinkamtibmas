'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useEffect, useState } from 'react';

/** Palet kategori yang terbaca di tema terang maupun gelap. */
export const SERIES_COLORS = ['#1d4ed8', '#0ea5e9', '#7c3aed', '#f59e0b', '#e11d48', '#16a34a', '#94a3b8'];

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
  const text = dark ? '#94a3b8' : '#64748b';
  const line = dark ? '#23314a' : '#e2e8f0';
  const themed: EChartsOption = {
    color: SERIES_COLORS,
    textStyle: { fontFamily: 'inherit', color: text },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: dark ? '#121b2e' : '#fff', borderColor: line, textStyle: { color: dark ? '#e6edf7' : '#0f1b2d' } },
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
