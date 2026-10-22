'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Flame, MapPinned } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import { CATEGORY_COLOR, type MapSummary } from './categories';
import { CATEGORY_LABEL } from '@/lib/format';
import { withParams } from '@/lib/url';
import { signalMapLoading } from './report-map';
import { MapRegionFilter } from './map-region-filter';
import { PriorityStrip } from './priority-strip';

const RANGES = [7, 30, 90];
type Search = { hari?: string; category?: string; priority?: string; provinsiKode?: string; kabupatenKode?: string; kecamatanKode?: string; regionCode?: string; regionLevel?: string };

export function MapOverlays({ summary, days, search }: { summary: MapSummary; days: number; search: Search }) {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const counts = summary.byCategory;
  const shown = search.category ? (counts[search.category] ?? 0) : summary.total;
  const href = (patch: Partial<Search>) => withParams('/peta', search, patch);

  return (
    <>
      {/* Bilah filter menempel di bawah topbar, selebar peta. */}
      <div className="absolute inset-x-0 top-0 z-[600] border-b border-line/80 bg-surface/88 shadow-[0_8px_24px_-18px_rgba(15,35,65,.45)] backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2.5 overflow-x-auto px-3 sm:px-5 [scrollbar-width:none]">
          <nav aria-label="Periode tanggal peta" className="flex h-9 shrink-0 items-center rounded-xl bg-bg/80 pl-2.5 pr-1 ring-1 ring-line/70">
            <CalendarDays size={15} className="mr-1.5 shrink-0 text-primary" aria-hidden />
            {RANGES.map((d) => (
              <Link key={d} onClick={signalMapLoading} href={href({ hari: d === 7 ? undefined : String(d) })} aria-current={days === d ? 'page' : undefined}
                className={cn('flex h-7 items-center whitespace-nowrap rounded-lg px-3 text-xs transition', days === d ? 'bg-surface font-semibold text-primary shadow-sm ring-1 ring-line/60' : 'font-medium text-muted hover:bg-surface/70 hover:text-ink')}>
                {d} hari
              </Link>
            ))}
          </nav>
          <div className="shrink-0">
            <MapRegionFilter />
          </div>
        </div>
      </div>

      <section className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-[500] flex items-start justify-end gap-3 p-3 sm:p-5 lg:p-6">
        <div className={cn('pointer-events-auto mt-14 overflow-hidden rounded-2xl border border-line/80 bg-surface/90 shadow-[0_12px_32px_-20px_rgba(15,35,65,.38)] backdrop-blur-xl transition-[width,height] duration-200', filtersCollapsed ? 'w-auto' : 'flex h-[min(26rem,calc(100dvh_-_10rem))] w-[20rem] max-w-[calc(100vw_-_1.5rem)] flex-col')}>
          <header className="flex shrink-0 items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 text-primary">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft"><MapPinned size={16} /></span>
              {!filtersCollapsed && <div className="min-w-0"><h1 className="text-base font-semibold leading-tight text-ink">Peta sebaran</h1><p className="truncate text-[11px] text-muted">{shown.toLocaleString('id-ID')} titik · {days} hari</p></div>}
            </div>
            <button type="button" aria-label={filtersCollapsed ? 'Buka filter peta' : 'Ciutkan filter peta'} aria-expanded={!filtersCollapsed} onClick={() => setFiltersCollapsed((v) => !v)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-primary">{filtersCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button>
          </header>
          {!filtersCollapsed && <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-3 pb-3 sm:px-3.5">
            <div className="flex items-center justify-between gap-2 pt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Kategori</p>
              {summary.flagged > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">{summary.flagged} lokasi dicek</span>}
            </div>
            <div className="mt-1.5">
              <ul className="space-y-0.5">
                <li><Link onClick={signalMapLoading} href={href({ category: undefined })} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-bg', !search.category && 'bg-bg font-semibold text-ink')}><span className="h-2 w-2 rounded-full bg-primary" /><span className="flex-1">Semua kategori</span><span className="tabular-nums text-muted">{summary.total}</span></Link></li>
                {Object.keys(CATEGORY_LABEL).map((k) => <li key={k}><Link onClick={signalMapLoading} href={href({ category: search.category === k ? undefined : k })} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-bg', search.category === k && 'bg-bg font-semibold text-ink', !counts[k] && 'opacity-50')}><span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[k] }} /><span className="flex-1">{CATEGORY_LABEL[k]}</span><span className="tabular-nums text-muted">{counts[k] ?? 0}</span></Link></li>)}
              </ul>
              <Link onClick={signalMapLoading} href={href({ priority: search.priority ? undefined : 'true' })} className={cn('mt-1.5 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition', search.priority ? 'border-danger/25 bg-danger-soft text-danger' : 'border-line bg-bg/60 text-muted hover:border-danger/30 hover:text-danger')}><Flame size={14} />{search.priority ? 'Prioritas saja aktif' : 'Tampilkan prioritas saja'}</Link>
            </div>
          </div>}
        </div>
      </section>

      <PriorityStrip items={summary.priority} />
    </>
  );
}
