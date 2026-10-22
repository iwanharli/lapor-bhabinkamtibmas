import { Layers } from 'lucide-react';
import { Delta, Sparkline, SplitBar } from '@/components/ui';
import { CATEGORY_LABEL } from '@/lib/format';
import type { Overview } from '@/lib/types';

const SPLIT_CLASS = ['bg-white', 'bg-accent', 'bg-sky-300'];

/** Kartu utama bergradasi: total laporan, perubahan, tren harian (latar), dan proporsi kategori teratas. */
export function TotalReportsHero({ ov }: { ov: Overview }) {
  const t = ov.totals;
  const perDay = ov.range.days ? t.total / ov.range.days : 0;
  const daily = [...ov.daily.reduce((m, d) => m.set(d.hari, (m.get(d.hari) ?? 0) + d.jumlah), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
  const top = [...ov.byCategory].sort((a, b) => b.jumlah - a.jumlah).slice(0, 3);
  const lainnya = Math.max(t.total - top.reduce((n, c) => n + c.jumlah, 0), 0);

  return (
    <section className="relative flex h-full min-h-[216px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#102b58] via-[#1d437e] to-[#315f9e] p-5 text-white shadow-[0_18px_40px_-22px_rgba(15,45,100,0.7)] ring-1 ring-white/10 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-sky-300/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-white/[0.06] to-transparent" />
      {/* Sparkline sebagai latar di separuh kanan, tidak mendesak teks. */}
      <Sparkline values={daily} className="pointer-events-none absolute bottom-16 right-0 hidden h-20 w-[38%] text-white opacity-45 lg:block" />

      <div className="relative">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90"><Layers size={18} /> Total laporan</p>
        <p className="mt-1 text-sm text-white/70">Semua laporan Bhabin yang masuk di periode ini</p>
      </div>

      <div className="relative mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="text-6xl font-bold leading-none tracking-[-0.045em] tabular-nums">{t.total.toLocaleString('id-ID')}</p>
        <div className="space-y-1 pb-1">
          <Delta now={t.total} prev={ov.previous.total} onDark />
          <p className="text-sm text-white/75">≈ {perDay.toLocaleString('id-ID', { maximumFractionDigits: 1 })} laporan / hari</p>
        </div>
      </div>

      <div className="relative mt-auto pt-5">
        <SplitBar
          onDark
          parts={[
            ...top.map((c, i) => ({ label: CATEGORY_LABEL[c.category] ?? c.category, value: c.jumlah, className: SPLIT_CLASS[i] })),
            ...(lainnya ? [{ label: 'Lainnya', value: lainnya, className: 'bg-white/35' }] : []),
          ]}
        />
      </div>
    </section>
  );
}
