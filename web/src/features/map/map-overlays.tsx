'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import { CATEGORY_COLOR, type MapSummary } from './categories';
import { CATEGORY_LABEL } from '@/lib/format';
import { withParams } from '@/lib/url';
import { signalMapLoading } from './report-map';
import { MapRegionFilter } from './map-region-filter';
import { PriorityStrip } from './priority-strip';

const RANGES = [7, 30, 90];
type Search = { hari?: string; category?: string; priority?: string; provinsiKode?: string; kabupatenKode?: string; kecamatanKode?: string; desaKode?: string; regionCode?: string; regionLevel?: string };

export function MapOverlays({ summary, days, search }: { summary: MapSummary; days: number; search: Search }) {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  // Layar sempit: panel mulai terlipat agar peta tetap terlihat.
  useEffect(() => { if (window.innerWidth < 900) setFiltersCollapsed(true); }, []);
  const counts = summary.byCategory;
  const shown = search.category ? (counts[search.category] ?? 0) : summary.total;
  const href = (patch: Partial<Search>) => withParams('/peta', search, patch);

  return (
    <>
      {/* Periode & wilayah: pil kaca mengambang di atas peta. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[600] flex lg:right-[20.5rem]">
        <div className="map-glass-card pointer-events-auto flex h-11 max-w-full items-center gap-1 overflow-x-auto px-1.5 [scrollbar-width:none]">
          <nav aria-label="Periode tanggal peta" className="flex shrink-0 items-center gap-0.5">
            {RANGES.map((d) => (
              <Link key={d} onClick={signalMapLoading} href={href({ hari: d === 7 ? undefined : String(d) })} aria-current={days === d ? 'page' : undefined}
                className={cn('flex h-8 items-center whitespace-nowrap rounded-lg px-2.5 text-xs transition', days === d ? 'bg-accent font-bold text-[#1a1405]' : 'font-medium text-muted hover:bg-bg hover:text-ink')}>
                {d} hari
              </Link>
            ))}
          </nav>
          <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
          <div className="shrink-0"><MapRegionFilter /></div>
        </div>
      </div>

      {/* Ringkasan: angka besar, lalu kategori dengan batang proporsi. */}
      <aside className={cn('map-glass-card pointer-events-auto absolute right-3 top-3 z-[550] flex w-[19rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden transition-[max-height] duration-200 max-lg:top-[4.25rem]', !filtersCollapsed && 'max-h-[calc(100%-var(--strip-h,0px)-5.5rem)] lg:max-h-[calc(100%-var(--strip-h,0px)-2rem)]', filtersCollapsed && 'w-auto')}>
        <header className="flex shrink-0 items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <h1 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Peta sebaran</h1>
            <p className="mt-1 text-4xl font-extrabold leading-none tracking-tight tabular-nums">{shown.toLocaleString('id-ID')}</p>
            <p className="mt-1 text-xs text-muted">titik laporan · {days} hari terakhir</p>
          </div>
          <button type="button" aria-label={filtersCollapsed ? 'Buka filter peta' : 'Ciutkan filter peta'} aria-expanded={!filtersCollapsed} onClick={() => setFiltersCollapsed((v) => !v)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-ink">{filtersCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
        </header>
        {!filtersCollapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-line p-2">
            <Link onClick={signalMapLoading} href={href({ category: undefined })} className={cn('block rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-bg', !search.category && 'bg-bg font-semibold')}>Semua kategori</Link>
            <ul className="mt-0.5 space-y-0.5">
              {Object.keys(CATEGORY_LABEL).map((k) => {
                const count = counts[k] ?? 0;
                return (
                  <li key={k}>
                    <Link onClick={signalMapLoading} href={href({ category: search.category === k ? undefined : k })} className={cn('block rounded-lg px-2.5 py-1.5 text-xs transition hover:bg-bg', search.category === k && 'bg-bg font-semibold', !count && 'opacity-55')}>
                      <span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[k] }} /><span className="flex-1 truncate">{CATEGORY_LABEL[k]}</span><span className="font-semibold tabular-nums">{count.toLocaleString('id-ID')}</span></span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${summary.total ? (count / summary.total) * 100 : 0}%`, background: CATEGORY_COLOR[k] }} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
              <Link onClick={signalMapLoading} href={href({ priority: search.priority ? undefined : 'true' })} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition', search.priority ? 'bg-danger-soft text-danger' : 'bg-bg text-muted hover:text-danger')}><Flame size={14} />{search.priority ? 'Prioritas saja aktif' : 'Prioritas saja'}</Link>
              {summary.flagged > 0 && <span className="flex items-center gap-1.5 rounded-lg bg-warn-soft px-2.5 py-2 text-xs font-medium text-warn"><TriangleAlert size={13} />{summary.flagged} dicek</span>}
            </div>
          </div>
        )}
      </aside>

      <PriorityStrip items={summary.priority} />
    </>
  );
}
