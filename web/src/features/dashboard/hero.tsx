import { Layers } from 'lucide-react';
import { Delta, Sparkline } from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/format';
import type { Overview } from '@/lib/types';

/** Kartu utama bergradasi: total laporan, perubahan, rata-rata harian, kategori teratas, dan tren harian. */
export function TotalReportsHero({ ov }: { ov: Overview }) {
  const t = ov.totals;
  const perDay = ov.range.days ? t.total / ov.range.days : 0;
  const daily = [...ov.daily.reduce((m, d) => m.set(d.hari, (m.get(d.hari) ?? 0) + d.jumlah), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
  const top = [...ov.byCategory].sort((a, b) => b.jumlah - a.jumlah).slice(0, 3);

  return (
    <section className="relative flex h-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e2550] via-[#1d437e] to-[#3a6db0] p-4 text-white shadow-[0_18px_40px_-22px_rgba(15,45,100,0.7)] ring-1 ring-white/10 sm:p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/90"><Layers size={16} /> Total laporan</p>
        <div className="mt-auto flex flex-wrap items-end gap-x-3 gap-y-1 pt-3">
          <p className="text-5xl font-bold leading-none tracking-[-0.045em] tabular-nums">{t.total.toLocaleString('id-ID')}</p>
          <p className="pb-1 text-xs text-white/75">≈ {perDay.toLocaleString('id-ID', { maximumFractionDigits: 1 })} / hari</p>
        </div>
        <Delta now={t.total} prev={ov.previous.total} onDark label="vs periode sebelumnya" className="mt-2 text-xs" />
      </div>
      <div className="relative hidden w-[46%] flex-col justify-between gap-2 sm:flex">
        <div className="flex flex-wrap justify-end gap-1.5">
          {top.map((c) => (
            <span key={c.category} className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] text-white/90 ring-1 ring-white/15">
              {CATEGORY_LABEL[c.category] ?? c.category} <strong className="tabular-nums text-white">{c.jumlah.toLocaleString('id-ID')}</strong>
            </span>
          ))}
        </div>
        <Sparkline values={daily} className="h-12 w-full text-sky-200" />
      </div>
    </section>
  );
}
