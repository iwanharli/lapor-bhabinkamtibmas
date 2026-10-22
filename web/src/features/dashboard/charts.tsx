'use client';

import { EChart } from '@/components/charts/echart';
import { CATEGORY_LABEL } from '@/lib/format';
import type { Overview } from '@/lib/types';

const dayLabel = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export function DailyByCategoryChart({ rows }: { rows: Overview['daily'] }) {
  const days = [...new Set(rows.map((r) => r.hari))].sort();
  const cats = Object.keys(CATEGORY_LABEL).filter((c) => rows.some((r) => r.category === c));
  const val = new Map(rows.map((r) => [`${r.hari}|${r.category}`, r.jumlah]));
  return (
    <EChart
      option={{
        xAxis: { type: 'category', data: days.map(dayLabel) },
        yAxis: { type: 'value', minInterval: 1 },
        series: cats.map((c) => ({
          name: CATEGORY_LABEL[c],
          type: 'bar',
          stack: 'total',
          barMaxWidth: 18,
          data: days.map((d) => val.get(`${d}|${c}`) ?? 0),
        })),
      }}
    />
  );
}
