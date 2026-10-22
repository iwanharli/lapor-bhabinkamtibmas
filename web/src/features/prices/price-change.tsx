import { cn } from '@/components/ui';
import { persen } from '@/lib/format';

/** Perubahan harga dalam persen; naik ≥10% ditandai merah. */
export function PriceChange({ now, prev }: { now: number | null; prev: number | null }) {
  const p = persen(now, prev);
  if (p == null) return <span className="text-muted">—</span>;
  const tone = p >= 10 ? 'font-semibold text-danger' : p > 0 ? 'text-warn' : p < 0 ? 'text-success' : 'text-muted';
  return (
    <span className={cn('whitespace-nowrap tabular-nums', tone)}>
      {p > 0 ? '▲' : p < 0 ? '▼' : '•'} {Math.abs(p).toLocaleString('id-ID')}%
    </span>
  );
}

export const isSpike = (p: { rata2: number | null; rata2_sebelumnya: number | null }) => (persen(p.rata2, p.rata2_sebelumnya) ?? 0) >= 10;
