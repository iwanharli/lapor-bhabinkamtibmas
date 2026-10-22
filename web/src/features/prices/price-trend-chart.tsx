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
  return (
    <EChart
      height={300}
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
  );
}
