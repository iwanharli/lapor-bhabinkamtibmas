import { UserCheck } from 'lucide-react';
import { Delta, RingProgress } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Partisipasi Bhabin: yang melapor minimal sekali ÷ seluruh Bhabin aktif dalam cakupan. */
export function ParticipationCard({ ov }: { ov: Overview }) {
  const { bhabinAktif, totalBhabin } = ov.totals;
  const pct = totalBhabin ? (bhabinAktif / totalBhabin) * 100 : 0;
  return (
    <section className="flex h-full flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(var(--shadow-tint)/0.04),0_8px_22px_-16px_rgb(var(--shadow-tint)/0.2)] sm:flex-row sm:gap-5 sm:p-5">
      <RingProgress value={pct} label="Partisipasi" size={104} />
      <div className="min-w-0 text-center sm:text-left">
        <p className="flex items-center justify-center gap-2 font-semibold sm:justify-start"><UserCheck size={18} className="text-success" /> Bhabin aktif melapor</p>
        <p className="mt-2 text-5xl font-bold tracking-[-0.04em] tabular-nums">
          {bhabinAktif}
          <span className="ml-1 text-2xl font-medium text-muted">/ {totalBhabin}</span>
        </p>
        <Delta now={bhabinAktif} prev={ov.previous.bhabinAktif} className="mt-3" />
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">Bhabin yang mengirim minimal 1 laporan di periode ini.</p>
      </div>
    </section>
  );
}
