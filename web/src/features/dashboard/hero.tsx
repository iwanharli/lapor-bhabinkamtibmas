import { Layers } from 'lucide-react';
import { Delta, Sparkline, SplitBar } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Kartu utama bergradasi: total laporan, perubahan, tren harian (latar), dan proporsi status. */
export function TotalReportsHero({ ov }: { ov: Overview }) {
  const t = ov.totals;
  const perDay = ov.range.days ? t.total / ov.range.days : 0;
  const daily = [...ov.daily.reduce((m, d) => m.set(d.hari, (m.get(d.hari) ?? 0) + d.jumlah), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
  const lainnya = Math.max(t.total - t.disetujui - t.menunggu, 0);

  return (
    <section className="relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-navy-2 via-primary to-primary-2 p-6 text-white shadow-xl shadow-primary/30 ring-1 ring-accent/30">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
      {/* Sparkline sebagai latar di separuh kanan, tidak mendesak teks. */}
      <Sparkline values={daily} className="pointer-events-none absolute bottom-20 right-0 hidden h-24 w-[46%] text-white opacity-90 sm:block" />

      <div className="relative">
        <p className="flex items-center gap-2 font-semibold"><Layers size={18} /> Total laporan</p>
        <p className="mt-1 text-sm text-white/75">Semua laporan Bhabin yang masuk di periode ini</p>
      </div>

      <div className="relative mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p className="text-6xl font-bold leading-none tracking-tight tabular-nums">{t.total.toLocaleString('id-ID')}</p>
        <div className="space-y-1 pb-1">
          <Delta now={t.total} prev={ov.previous.total} onDark />
          <p className="text-sm text-white/75">≈ {perDay.toLocaleString('id-ID', { maximumFractionDigits: 1 })} laporan / hari</p>
        </div>
      </div>

      <div className="relative mt-auto pt-6">
        <SplitBar
          onDark
          parts={[
            { label: 'Disetujui', value: t.disetujui, className: 'bg-white' },
            { label: 'Menunggu', value: t.menunggu, className: 'bg-accent' },
            { label: 'Revisi/ditolak', value: lainnya, className: 'bg-rose-300' },
          ]}
        />
      </div>
    </section>
  );
}
