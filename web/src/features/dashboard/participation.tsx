import { UserCheck } from 'lucide-react';
import { Delta, RingProgress } from '@/components/ui';
import type { Overview } from '@/lib/types';

/** Partisipasi Bhabin: yang melapor minimal sekali ÷ seluruh Bhabin aktif dalam cakupan. */
export function ParticipationCard({ ov }: { ov: Overview }) {
  const { bhabinAktif, totalBhabin } = ov.totals;
  const pct = totalBhabin ? (bhabinAktif / totalBhabin) * 100 : 0;
  return (
    <section className="flex h-full flex-col items-center gap-6 rounded-2xl border border-success/25 bg-gradient-to-br from-success-soft/60 to-surface p-6 shadow-sm sm:flex-row">
      <RingProgress value={pct} label="Partisipasi" />
      <div>
        <p className="flex items-center gap-2 font-semibold"><UserCheck size={18} className="text-success" /> Bhabin aktif melapor</p>
        <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">
          {bhabinAktif}
          <span className="ml-1 text-2xl font-medium text-muted">/ {totalBhabin}</span>
        </p>
        <Delta now={bhabinAktif} prev={ov.previous.bhabinAktif} className="mt-3" />
        <p className="mt-3 max-w-md text-sm text-muted">Bhabin yang mengirim minimal 1 laporan di periode ini. Partisipasi = Bhabin aktif ÷ seluruh Bhabin.</p>
      </div>
    </section>
  );
}
