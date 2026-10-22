import { CalendarDays, Flame } from 'lucide-react';
import Link from 'next/link';
import { Card, cn, PageHeader, SegmentedLinks, Stack } from '@/components/ui';
import { CATEGORY_COLOR, type MapSummary } from '@/features/map/categories';
import { ReportMap } from '@/features/map/report-map';
import { apiGet } from '@/lib/api/server';
import { CATEGORY_LABEL, tanggalJam } from '@/lib/format';
import { withParams } from '@/lib/url';

const RANGES = [7, 30, 90];
type Search = { hari?: string; category?: string; priority?: string };

export default async function PetaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.hari)) ? Number(sp.hari) : 7;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();

  // Ringkasan panel dari server; titik/gugus dimuat peta per area tampilan.
  const summary = await apiGet<MapSummary>(withParams('/analytics/map/summary', { from, category: sp.category, priority: sp.priority }));
  const counts = summary.byCategory;
  const shown = sp.category ? (counts[sp.category] ?? 0) : summary.total;
  const { priority, flagged } = summary;
  const href = (patch: Partial<Search>) => withParams('/peta', sp, patch);

  return (
    <>
      <PageHeader
        title="Peta Sebaran"
        subtitle={`${shown.toLocaleString('id-ID')} titik laporan · ${days} hari terakhir${flagged ? ` · ${flagged} lokasi perlu dicek` : ''}`}
        actions={
          <SegmentedLinks
            active={String(days)}
            items={RANGES.map((d) => ({ key: String(d), label: `${d} hari`, href: href({ hari: d === 7 ? undefined : String(d) }), icon: d === days ? <CalendarDays size={15} /> : undefined }))}
          />
        }
      />
      <Stack>
        {/* Proporsi melebar mengikuti bentang Indonesia (±46° bujur × 17° lintang). */}
        <Card className="flex flex-col" bodyClassName="aspect-[12/5] max-h-[78vh] min-h-[360px]">
          <ReportMap filters={{ from, category: sp.category, priority: sp.priority }} />
        </Card>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
          <Card title="Kategori" subtitle="Klik untuk menyaring titik">
            <ul className="p-2">
              <li>
                <Link href={href({ category: undefined })} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-bg', !sp.category && 'bg-primary-soft font-semibold')}>
                  Semua kategori <span className="tabular-nums">{summary.total}</span>
                </Link>
              </li>
              {Object.keys(CATEGORY_LABEL).map((k) => (
                <li key={k}>
                  <Link href={href({ category: sp.category === k ? undefined : k })}
                    className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-bg', sp.category === k && 'bg-primary-soft font-semibold', !counts[k] && 'opacity-50')}>
                    <span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ background: CATEGORY_COLOR[k] }} />
                    <span className="flex-1">{CATEGORY_LABEL[k]}</span>
                    <span className="tabular-nums text-muted">{counts[k] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-3">
              <Link href={href({ priority: sp.priority ? undefined : 'true' })}
                className={cn('flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
                  sp.priority ? 'border-danger/40 bg-danger-soft text-danger' : 'border-line text-muted hover:text-ink')}>
                <Flame size={16} /> {sp.priority ? 'Menampilkan prioritas saja' : 'Tampilkan prioritas saja'}
              </Link>
            </div>
          </Card>

          <Card title="Deteksi dini prioritas" subtitle="Titik bercincin merah di peta">
            {priority.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">Tidak ada laporan prioritas pada periode ini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {priority.map((p) => (
                  <li key={p.id}>
                    <Link href={`/laporan/${p.id}`} className="block px-5 py-3 text-sm hover:bg-bg">
                      <span className="font-medium text-danger">{p.desa}</span> · {p.bhabin}
                      <span className="block font-mono text-xs text-muted">{p.nomor}</span>
                      <span className="block text-xs text-muted">{tanggalJam(p.occurred_at, p.timezone)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Stack>
    </>
  );
}
