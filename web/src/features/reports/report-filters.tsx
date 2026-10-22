'use client';

import { CalendarRange, Flame, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { cn, Input } from '@/components/ui';
import { withParams } from '@/lib/url';
import { RangePreset, ReportSearch, resolveRange } from './report-search';

const PRESETS: { key: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: 'semua', label: 'Semua' },
];

/** Bar filter laporan: pilihan langsung diterapkan, pencarian diterapkan setelah berhenti mengetik. Semua state di URL. */
export function ReportFilters({ value, tz }: { value: ReportSearch; tz?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(value.q ?? '');
  // Lewati efek pencarian pada render pertama dan setelah reset (agar tidak menimpa URL dengan filter lama).
  const skipSearch = useRef(true);

  const apply = (patch: Partial<ReportSearch>) =>
    start(() => router.push(withParams(pathname, { ...value, page: undefined }, patch)));

  // Debounce pencarian teks.
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const range = resolveRange(value, tz);
  // Rentang default (7 hari) tidak dihitung sebagai filter aktif.
  const active = !!(value.q || value.category || value.priority || range.preset !== '7');
  // Ubah tanggal manual → rentang kustom; pilihan cepat → hapus from/to.
  const setDate = (k: 'from' | 'to', v: string) =>
    apply({ from: range.from, to: range.to, [k]: v || undefined, rentang: undefined });
  const setPreset = (key: Exclude<RangePreset, 'custom'>) => apply({ from: undefined, to: undefined, rentang: key === '7' ? undefined : key });
  const priorityOn = value.priority === 'true';

  return (
    <div className={cn('flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center', pending && 'opacity-70')}>
      <label className="relative flex-1">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor laporan, nama Bhabin, atau desa…" className="pl-10" aria-label="Cari laporan" />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-surface">
          <div className="flex items-center gap-1.5 px-2.5">
            <CalendarRange size={16} className="text-muted" />
            <input type="date" value={range.from ?? ''} max={range.to} onChange={(e) => setDate('from', e.target.value)} aria-label="Dari tanggal"
              className="bg-transparent py-2 text-sm outline-none" />
            <span className="text-muted">–</span>
            <input type="date" value={range.to ?? ''} min={range.from} onChange={(e) => setDate('to', e.target.value)} aria-label="Sampai tanggal"
              className="bg-transparent py-2 text-sm outline-none" />
          </div>
          <div className="flex gap-0.5 border-l border-line p-1">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPreset(p.key)} aria-pressed={range.preset === p.key}
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition',
                  range.preset === p.key ? 'bg-primary text-white' : 'text-muted hover:bg-bg hover:text-ink',
                )}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => apply({ priority: priorityOn ? undefined : 'true' })}
          aria-pressed={priorityOn}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
            priorityOn ? 'border-danger/40 bg-danger-soft text-danger' : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          <Flame size={16} /> Prioritas
        </button>

        {active && (
          <button type="button" onClick={() => {
              skipSearch.current = true;
              setQ('');
              start(() => router.push(withParams(pathname, { status: value.status, limit: value.limit })));
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-bg hover:text-ink">
            <X size={15} /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
