'use client';

import { ChevronDown, GitCompareArrows, Shapes, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { cn, UrlSelect } from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/format';

/** Tombol "Filter" dengan jumlah penyaring aktif; isinya tampil di baris sendiri hanya saat dibuka. */
export function FilterPanel({ count, controls, status, children }: { count: number; controls: React.ReactNode; status?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-white/15 bg-black/15 px-6 py-3 text-ink">
      <div className="flex flex-wrap items-center gap-2 [&_.relative>div]:h-10">
        {controls}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:border-primary/40">
          <SlidersHorizontal size={15} className="text-muted" /> Filter
          {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-[#1a1405]">{count}</span>}
          <ChevronDown size={15} className={cn('text-muted transition-transform', open && 'rotate-180')} />
        </button>
        {status && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">{status}</div>}
      </div>
      {open && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">{children}</div>}
    </div>
  );
}

export function FilterSelects({ kategori, pembanding }: { kategori: string; pembanding: string }) {
  return (
    <>
      <UrlSelect param="kategori" label="Kategori" icon={Shapes} value={kategori} className="w-full sm:w-56"
        options={[{ value: '', label: 'Semua kategori' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
      <UrlSelect param="pembanding" label="Pembanding" icon={GitCompareArrows} value={pembanding} className="w-full sm:w-52"
        options={[{ value: '', label: 'Banding bulan lalu' }, { value: 'tahun', label: 'Banding tahun lalu' }]} />
    </>
  );
}
