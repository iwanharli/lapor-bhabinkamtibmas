import Link from 'next/link';
import { cn, Delta, RingProgress } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Partisipasi Bhabin (ringkas): yang melapor minimal sekali ÷ seluruh Bhabin aktif dalam cakupan. */
export function ParticipationCard({ ov }: { ov: Overview }) {
  const { bhabinAktif, totalBhabin, tidakAktif7 } = ov.totals;
  const belum = Math.max(totalBhabin - bhabinAktif, 0);
  const pct = totalBhabin ? (bhabinAktif / totalBhabin) * 100 : 0;
  return (
    <section className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.04),0_8px_22px_-16px_rgb(var(--shadow-tint)/0.2)]">
      <div className="flex items-center gap-3">
        <RingProgress value={pct} size={84} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Bhabin melapor</p>
          <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums">
            {bhabinAktif.toLocaleString('id-ID')}
            <span className="ml-1 text-base font-medium text-muted">/ {totalBhabin.toLocaleString('id-ID')}</span>
          </p>
          <Delta now={bhabinAktif} prev={ov.previous.bhabinAktif} label="" className="mt-2 text-xs" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
        <Link href="/kinerja" className="rounded-lg bg-surface-2 px-2.5 py-1.5 hover:bg-primary-soft">
          <span className="block font-bold tabular-nums text-ink">{belum.toLocaleString('id-ID')}</span>
          <span className="text-muted">belum melapor</span>
        </Link>
        <Link href="/kinerja" className={cn('rounded-lg px-2.5 py-1.5 hover:bg-primary-soft', tidakAktif7 ? 'bg-danger-soft/60' : 'bg-surface-2')}>
          <span className={cn('block font-bold tabular-nums', tidakAktif7 ? 'text-danger' : 'text-ink')}>{tidakAktif7.toLocaleString('id-ID')}</span>
          <span className="text-muted">tak melapor 7 hari</span>
        </Link>
      </div>
    </section>
  );
}
