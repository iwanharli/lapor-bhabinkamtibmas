import { MapPin } from 'lucide-react';
import { cn, EmptyState } from '@/components/ui';
import { rupiah, tanggal } from '@/lib/format';
import type { PriceAreaRow } from '@/lib/types';

/** Harga per desa sebagai batang, diurutkan termahal; selisih dari rata-rata wilayah disorot. */
export function PriceAreaTable({ rows, average, tz }: { rows: PriceAreaRow[]; average?: number | null; tz?: string }) {
  if (rows.length === 0) return <EmptyState icon={<MapPin size={22} />} tone="neutral" title="Belum ada data">Belum ada laporan harga untuk komoditas ini dalam 7 hari.</EmptyState>;
  const max = Math.max(...rows.map((r) => r.rata2));
  return (
    <ul className="space-y-4 p-5">
      {rows.map((a) => {
        const dev = average ? ((a.rata2 - average) / average) * 100 : 0;
        return (
          <li key={`${a.kecamatan}-${a.desa}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{a.desa}</span>
                <span className="block text-xs text-muted">{a.kecamatan} · {a.sampel} sampel · {tanggal(a.terakhir, tz)}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <strong>{rupiah(a.rata2)}</strong>
                {average ? (
                  <span className={cn('ml-1.5 text-xs', dev >= 10 ? 'font-semibold text-danger' : dev <= -10 ? 'text-success' : 'text-muted')}>
                    {dev > 0 ? '+' : ''}{dev.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-2 rounded-full bg-primary-soft">
              <div className={cn('h-2 rounded-full', dev >= 10 ? 'bg-danger' : 'bg-gradient-to-r from-primary to-primary-2')} style={{ width: `${(a.rata2 / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
