import Link from 'next/link';
import { cn } from '@/components/ui';
import { rupiah } from '@/lib/format';
import type { LatestPrice } from '@/lib/types';
import { isSpike, PriceChange } from './price-change';

/** Kotak ringkas per komoditas: harga rata-rata 7 hari + perubahan; lonjakan disorot merah. */
export function PriceTiles({ prices }: { prices: LatestPrice[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {prices.map((p) => {
        const spike = isSpike(p);
        return (
          <Link
            key={p.commodity_id}
            href={`/harga-pangan?c=${p.commodity_id}`}
            className={cn(
              'rounded-xl border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
              spike ? 'border-danger/30 bg-gradient-to-br from-danger-soft/70 to-surface' : 'border-line',
            )}
          >
            <p className="truncate text-sm text-muted" title={p.nama}>{p.nama}</p>
            <p className="mt-1.5 text-lg font-bold tabular-nums">
              {p.rata2 ? rupiah(p.rata2) : '—'}
              <span className="text-xs font-normal text-muted">/{p.satuan}</span>
            </p>
            <div className="mt-1 text-xs"><PriceChange now={p.rata2} prev={p.rata2_sebelumnya} /></div>
          </Link>
        );
      })}
    </div>
  );
}
