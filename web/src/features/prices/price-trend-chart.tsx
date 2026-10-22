'use client';

import { EChart } from '@/components/charts/echart';
import type { PriceTrendRow } from '@/lib/types';

const dayLabel = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const rp = (v: unknown) => `Rp ${Number(v).toLocaleString('id-ID')}`;

/** Tren harga harian satu komoditas, dengan garis rata-rata periode. */
export function PriceTrendChart({ rows, nama }: { rows: PriceTrendRow[]; nama: string }) {
  const days = rows.map((r) => r.hari);
  const values = rows.map((r) => r.rata2);
  const avg = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const change = values.length > 1 && values[0] ? ((values.at(-1)! - values[0]) / values[0]) * 100 : null;
  const dayMin = days[values.indexOf(min)];
  const dayMax = days[values.indexOf(max)];
  const stats = [
    { label: 'Terendah', value: rp(min), sub: dayLabel(dayMin), cls: 'text-success' },
    { label: 'Tertinggi', value: rp(max), sub: dayLabel(dayMax), cls: 'text-danger' },
    { label: 'Rata-rata periode', value: rp(avg), sub: `${days.length} hari ada data`, cls: '' },
    { label: 'Perubahan periode', value: change == null ? '—' : `${change > 0 ? '+' : ''}${change.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, sub: `${dayLabel(days[0])} → ${dayLabel(days.at(-1)!)}`, cls: change == null ? '' : change > 0 ? 'text-danger' : 'text-success' },
  ];
  return (
    <div>
    <EChart
      height={340}
      option={{
        legend: { show: false },
        grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: days.map(dayLabel), boundaryGap: false },
        yAxis: { type: 'value', scale: true, axisLabel: { formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}rb` : String(v)) } },
        tooltip: { trigger: 'axis', valueFormatter: rp },
        series: [
          {
            name: nama,
            type: 'line',
            // Penghalusan ringan: kurva tidak "melampaui" titik data sebenarnya.
            smooth: 0.2,
            symbolSize: 6,
            data: values,
            lineStyle: { width: 3 },
            areaStyle: { opacity: 0.12 },
            markLine: {
              symbol: 'none',
              silent: true,
              lineStyle: { type: 'dashed', opacity: 0.6 },
              label: { formatter: () => `rata-rata ${rp(avg)}`, position: 'insideEndTop', fontSize: 11 },
              data: [{ yAxis: avg }],
            },
          },
        ],
      }}
    />
    <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-bg/60 px-3.5 py-2.5">
          <dt className="text-[11px] text-muted">{s.label}</dt>
          <dd className={`text-sm font-semibold tabular-nums ${s.cls}`}>{s.value}</dd>
          <dd className="text-[11px] text-muted">{s.sub}</dd>
        </div>
      ))}
    </dl>
    </div>
  );
}
