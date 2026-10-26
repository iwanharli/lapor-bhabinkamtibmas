import { Delta, RingProgress } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Partisipasi Bhabin (ringkas): yang melapor minimal sekali ÷ seluruh Bhabin aktif dalam cakupan. */
export function ParticipationCard({ ov }: { ov: Overview }) {
  const { bhabinAktif, totalBhabin } = ov.totals;
  const pct = totalBhabin ? (bhabinAktif / totalBhabin) * 100 : 0;
  return (
    <section className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.04),0_8px_22px_-16px_rgb(var(--shadow-tint)/0.2)]">
      <RingProgress value={pct} size={84} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Bhabin melapor</p>
        <p className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums">
          {bhabinAktif.toLocaleString('id-ID')}
          <span className="ml-1 text-base font-medium text-muted">/ {totalBhabin.toLocaleString('id-ID')}</span>
        </p>
        <Delta now={bhabinAktif} prev={ov.previous.bhabinAktif} label="" className="mt-2 text-xs" />
      </div>
    </section>
  );
}
