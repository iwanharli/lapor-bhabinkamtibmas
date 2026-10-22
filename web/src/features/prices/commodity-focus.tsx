import { Delta } from '@/components/ui';
import { rupiah } from '@/lib/format';
import type { LatestPrice } from '@/lib/types';

/** Posisi harga rata-rata di antara harga terendah–tertinggi. */
function RangeBar({ min, avg, max }: { min: number; avg: number; max: number }) {
  const pos = max > min ? ((avg - min) / (max - min)) * 100 : 50;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-success/60 via-warn/60 to-danger/60">
        <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink shadow" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
        <span>Terendah <strong className="text-ink">{rupiah(min)}</strong></span>
        <span>Tertinggi <strong className="text-ink">{rupiah(max)}</strong></span>
      </div>
    </div>
  );
}

/** Proporsi status stok dari laporan 7 hari. */
function StockBar({ p }: { p: LatestPrice }) {
  const aman = Math.max(p.sampel - p.stok_menipis - p.stok_kosong, 0);
  const parts = [
    { label: 'Aman', n: aman, cls: 'bg-success' },
    { label: 'Menipis', n: p.stok_menipis, cls: 'bg-warn' },
    { label: 'Kosong', n: p.stok_kosong, cls: 'bg-danger' },
  ];
  const total = p.sampel || 1;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-line">
        {parts.map((x) => <span key={x.label} className={x.cls} style={{ width: `${(x.n / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((x) => (
          <span key={x.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${x.cls}`} /> {x.label} <strong className="text-ink">{x.n}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ringkasan komoditas terpilih: harga, perubahan, rentang, dan stok. */
export function CommodityFocus({ p }: { p: LatestPrice }) {
  return (
    <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr_1fr] md:items-center">
      <div>
        <p className="text-sm text-muted">Rata-rata 7 hari terakhir</p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
          {p.rata2 ? rupiah(p.rata2) : '—'}
          <span className="ml-1 text-base font-medium text-muted">/{p.satuan}</span>
        </p>
        <Delta now={p.rata2 ?? 0} prev={p.rata2_sebelumnya ?? 0} inverse label="vs 7 hari sebelumnya" className="mt-2" />
        <p className="mt-1 text-xs text-muted">{p.sampel} sampel harga dari laporan Bhabin</p>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Rentang harga</p>
        {p.minimum != null && p.maksimum != null && p.rata2 != null ? <RangeBar min={p.minimum} avg={p.rata2} max={p.maksimum} /> : <p className="text-sm text-muted">Belum ada data</p>}
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">Kondisi stok</p>
        <StockBar p={p} />
      </div>
    </div>
  );
}
