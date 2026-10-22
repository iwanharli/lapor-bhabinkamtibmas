import { CalendarDays, CalendarCheck, FileStack, UserCheck, UserX } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, ExportButton, PageHeader, Pagination, SearchInput, SegmentedLinks, Stack, StatCard, UrlSelect } from '@/components/ui';
import { CATEGORY_COLOR } from '@/features/map/categories';
import { PerformanceTable, type SortKey } from '@/features/performance/performance-table';
import { CATEGORY_KEYS, type PerformancePage } from '@/features/performance/types';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { CATEGORY_LABEL } from '@/lib/format';
import type { UnitOption } from '@/lib/types';
import { withParams } from '@/lib/url';

const RANGES = [7, 30, 90];
const SORTS: SortKey[] = ['total', 'hari', 'setuju', 'nama'];
const SIZES = [20, 50, 100];
type Search = { hari?: string; urut?: string; q?: string; unitId?: string; page?: string; limit?: string };

/** Jumlah tanggal kalender WIB dalam rentang (termasuk hari ini). */
const calendarDays = (days: number) => days + 1;

export default async function KinerjaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getSessionUser();
  if (me?.role === 'BHABIN') redirect('/laporan');

  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.hari)) ? Number(sp.hari) : 30;
  const sort = (SORTS.includes(sp.urut as SortKey) ? sp.urut : 'total') as SortKey;
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const span = calendarDays(days);

  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const query = { from, unitId: sp.unitId, q: sp.q };

  const [{ data: rows, meta, summary }, units] = await Promise.all([
    apiGet<PerformancePage>(withParams('/analytics/bhabin-performance', { ...query, sort, page: String(page), limit: String(limit) })),
    apiGet<UnitOption[]>('/units'),
  ]);
  const reporting = summary.melapor;
  const avgPct = span ? Math.min((summary.rata_hari / span) * 100, 100) : 0;
  const totalReports = summary.total;
  const byCategory = CATEGORY_KEYS.map((k) => ({ k, n: rows.reduce((s, b) => s + b[k], 0) })).filter((c) => c.n);

  const href = (patch: Partial<Search>) => withParams('/kinerja', sp, patch);

  return (
    <>
      <PageHeader
        title="Kinerja Bhabinkamtibmas"
        subtitle={`Rekap kegiatan per Bhabin · ${days} hari terakhir`}
        actions={
          <>
            <ExportButton path={withParams('/exports/performance.csv', query)} />
            <SegmentedLinks
              active={String(days)}
              items={RANGES.map((d) => ({ key: String(d), label: `${d} hari`, href: href({ hari: d === 30 ? undefined : String(d) }), icon: d === days ? <CalendarDays size={15} /> : undefined }))}
            />
          </>
        }
      />
      <Stack>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Bhabin melapor" description="Minimal 1 laporan di periode ini" icon={<UserCheck size={20} />} tone="success"
            value={reporting} suffix={`/ ${summary.bhabin}`} footer={`${summary.bhabin ? Math.round((reporting / summary.bhabin) * 100) : 0}% partisipasi`} />
          <StatCard title="Rata-rata hari aktif" description="Hari dengan minimal 1 laporan" icon={<CalendarCheck size={20} />} tone="accent"
            value={`${Math.round(avgPct)}%`} footer={`dari ${span} hari kalender`} />
          <StatCard title="Total laporan" description="Seluruh Bhabin dalam cakupan" icon={<FileStack size={20} />}
            value={totalReports.toLocaleString('id-ID')} footer={`± ${summary.bhabin ? (totalReports / summary.bhabin).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0} per Bhabin`} />
          <StatCard alert={summary.kurang > 0} title="Kehadiran kurang" description="Hari aktif di bawah 40%" icon={<UserX size={20} />} tone="success"
            value={summary.kurang}
            footer={summary.kurang ? <a href={href({ urut: 'hari', page: undefined })} className="font-medium text-danger">lihat urutan hari aktif</a> : 'semua Bhabin aktif'} />
        </div>

        <Card
          title="Rekap per Bhabin"
          subtitle="Klik judul kolom untuk mengurutkan · klik baris untuk melihat laporannya"
          actions={
            <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-muted lg:flex">
              {byCategory.map((c) => (
                <span key={c.k} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c.k.toUpperCase()] }} />
                  {CATEGORY_LABEL[c.k.toUpperCase()]}
                </span>
              ))}
            </div>
          }
        >
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <SearchInput placeholder="Cari NRP atau nama Bhabin…" className="flex-1" />
            <UrlSelect param="unitId" label="Unit" options={[{ value: '', label: 'Semua unit' }, ...units.map((u) => ({ value: u.id, label: u.nama }))]} />
          </div>
          <PerformanceTable rows={rows} days={span} sort={sort} hrefFor={(k) => href({ urut: k === 'total' ? undefined : k, page: undefined })} />
          <Pagination
            page={page}
            limit={limit}
            total={meta.total}
            sizes={SIZES}
            noun="Bhabin"
            hrefFor={(p, l) => href({ page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </Card>
      </Stack>
    </>
  );
}
