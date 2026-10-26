import { Layers } from 'lucide-react';
import { Delta, Sparkline } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Kartu utama bergradasi (ringkas): total laporan, perubahan, rata-rata harian, dan tren harian di latar. */
export function TotalReportsHero({ ov }: { ov: Overview }) {
  const t = ov.totals;
  const perDay = ov.range.days ? t.total / ov.range.days : 0;
  const daily = [...ov.daily.reduce((m, d) => m.set(d.hari, (m.get(d.hari) ?? 0) + d.jumlah), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#102b58] via-[#1d437e] to-[#315f9e] p-4 text-white shadow-[0_18px_40px_-22px_rgba(15,45,100,0.7)] ring-1 ring-white/10">
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-300/15 blur-3xl" />
      <Sparkline values={daily} className="pointer-events-none absolute right-3 top-3 h-10 w-2/5 text-white opacity-45" />
      <p className="relative flex items-center gap-2 text-sm font-semibold text-white/90"><Layers size={16} /> Total laporan</p>
      <div className="relative mt-auto flex flex-wrap items-end gap-x-3 gap-y-1 pt-3">
        <p className="text-4xl font-bold leading-none tracking-[-0.04em] tabular-nums">{t.total.toLocaleString('id-ID')}</p>
        <p className="pb-0.5 text-xs text-white/75">≈ {perDay.toLocaleString('id-ID', { maximumFractionDigits: 1 })}/hari</p>
      </div>
      <Delta now={t.total} prev={ov.previous.total} onDark label="vs sebelumnya" className="relative mt-2 text-xs" />
    </section>
  );
}
