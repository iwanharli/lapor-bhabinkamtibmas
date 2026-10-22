'use client';

import { MapPin, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn, EmptyState } from '@/components/ui';
import { rupiah, tanggal } from '@/lib/format';
import type { PriceAreaRow } from '@/lib/types';

const SORTS = [
  { key: 'mahal', label: 'Termahal' },
  { key: 'murah', label: 'Termurah' },
  { key: 'nama', label: 'Nama desa' },
] as const;

/**
 * Harga per desa sebagai batang; selisih dari rata-rata wilayah disorot.
 * Tinggi tetap & bisa digulir; `filter` = pemilih wilayah (unit) dari halaman, plus cari desa/kecamatan & urutan di sisi klien.
 */
export function PriceAreaTable({ rows, average, tz, filter }: { rows: PriceAreaRow[]; average?: number | null; tz?: string; filter?: React.ReactNode }) {
  const [q, setQ] = useState('');
  const [kec, setKec] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('mahal');

  const kecamatan = useMemo(() => [...new Set(rows.map((r) => r.kecamatan))].sort(), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => (!kec || r.kecamatan === kec) && (!needle || `${r.desa} ${r.kecamatan} ${r.kabupaten ?? ''}`.toLowerCase().includes(needle)));
    return list.sort((a, b) => (sort === 'mahal' ? b.rata2 - a.rata2 : sort === 'murah' ? a.rata2 - b.rata2 : a.desa.localeCompare(b.desa, 'id')));
  }, [rows, q, kec, sort]);
  const max = Math.max(...rows.map((r) => r.rata2), 1);
  const naik = average ? rows.filter((r) => ((r.rata2 - average) / average) * 100 >= 10).length : 0;

  return (
    <div className="flex flex-col">
      <div className="space-y-2 border-b border-line p-3">
        {filter}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari desa / kecamatan…"
              className="h-9 w-full rounded-lg border border-line bg-bg pl-8 pr-2 text-sm outline-none focus:border-primary/50" />
          </label>
          {kecamatan.length > 1 && (
            <select value={kec} onChange={(e) => setKec(e.target.value)} className="h-9 max-w-[9.5rem] rounded-lg border border-line bg-bg px-2 text-sm">
              <option value="">Semua kec.</option>
              {kecamatan.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">
            {shown.length.toLocaleString('id-ID')} dari {rows.length.toLocaleString('id-ID')} desa
            {naik > 0 && <span className="ml-1.5 font-medium text-danger">· {naik} ≥10% di atas rata-rata</span>}
          </span>
          <span className="flex rounded-lg bg-bg p-0.5 ring-1 ring-line">
            {SORTS.map((s) => (
              <button key={s.key} type="button" onClick={() => setSort(s.key)}
                className={cn('rounded-md px-2 py-0.5 font-medium transition', sort === s.key ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink')}>{s.label}</button>
            ))}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<MapPin size={22} />} tone="neutral" title="Belum ada data" className="py-10">Belum ada laporan harga untuk komoditas ini dalam 7 hari di wilayah ini.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={<SearchX size={22} />} tone="neutral" title="Tidak ada desa yang cocok" className="py-10">Ubah kata kunci atau kecamatan.</EmptyState>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-line/60 scroll-thin overflow-y-auto">
          {shown.map((a) => {
            const dev = average ? ((a.rata2 - average) / average) * 100 : 0;
            return (
              <li key={`${a.kabupaten}-${a.kecamatan}-${a.desa}`} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{a.desa}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{rupiah(a.rata2)}</strong>
                    {average ? (
                      <span className={cn('ml-1.5 inline-block w-12 text-right text-xs', dev >= 10 ? 'font-semibold text-danger' : dev <= -10 ? 'text-success' : 'text-muted')}>
                        {dev > 0 ? '+' : ''}{dev.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-primary-soft">
                    <div className={cn('h-1.5 rounded-full', dev >= 10 ? 'bg-danger' : 'bg-gradient-to-r from-primary to-primary-2')} style={{ width: `${(a.rata2 / max) * 100}%` }} />
                  </div>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted">{a.kecamatan}{a.kabupaten ? `, ${a.kabupaten}` : ''} · {a.sampel} sampel · {tanggal(a.terakhir, tz)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
