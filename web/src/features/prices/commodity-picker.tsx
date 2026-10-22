import Link from 'next/link';
import { cn, Sparkline } from '@/components/ui';
import { rupiah } from '@/lib/format';
import type { LatestPrice } from '@/lib/types';
import { isSpike, PriceChange } from './price-change';

/** Kotak komoditas yang bisa dipilih: harga 7 hari, perubahan, dan sparkline tren periode. */
export function CommodityPicker({
  prices,
  series,
  selectedId,
  hrefFor,
}: {
  prices: LatestPrice[];
  series: Map<number, (number | null)[]>;
  selectedId?: number;
  hrefFor: (commodityId: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {prices.map((p) => {
        const active = p.commodity_id === selectedId;
        const spike = isSpike(p);
        return (
          <Link
            key={p.commodity_id}
            href={hrefFor(p.commodity_id)}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md',
              active ? 'border-primary ring-2 ring-primary/25 shadow-md' : spike ? 'border-danger/30' : 'border-line shadow-sm',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium" title={p.nama}>{p.nama}</p>
              {spike && <span className="shrink-0 rounded-full bg-danger-soft px-1.5 text-[10px] font-bold uppercase text-danger">Naik</span>}
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {p.rata2 ? rupiah(p.rata2) : '—'}
              <span className="text-xs font-normal text-muted">/{p.satuan}</span>
            </p>
            <div className="text-xs"><PriceChange now={p.rata2} prev={p.rata2_sebelumnya} /></div>
            <Sparkline
              values={series.get(p.commodity_id) ?? []}
              className={cn('mt-2 h-9 w-full', spike ? 'text-danger' : active ? 'text-primary' : 'text-primary-2/70')}
            />
          </Link>
        );
      })}
    </div>
  );
}
