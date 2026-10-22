import { CalendarDays, CalendarCheck, FileStack, UserCheck, UserX } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, ExportButton, PageHeader, SegmentedLinks, Stack, StatCard } from '@/components/ui';
import { CATEGORY_COLOR } from '@/features/map/categories';
import { PerformanceTable, type SortKey } from '@/features/performance/performance-table';
import { attendance, CATEGORY_KEYS, type BhabinPerformance } from '@/features/performance/types';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { CATEGORY_LABEL } from '@/lib/format';
import { withParams } from '@/lib/url';

const RANGES = [7, 30, 90];
const SORTS: SortKey[] = ['total', 'hari', 'setuju', 'nama'];
type Search = { hari?: string; urut?: string };

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

  const rows = await apiGet<BhabinPerformance[]>(`/analytics/bhabin-performance?from=${from}`);
  const pct = (b: BhabinPerformance) => Math.min((b.hari_aktif / span) * 100, 100);
  const approval = (b: BhabinPerformance) => {
    const d = b.disetujui + b.revisi + b.ditolak;
    return d ? b.disetujui / d : -1;
  };
  const sorted = [...rows].sort((a, b) =>
    sort === 'nama' ? a.nama.localeCompare(b.nama) : sort === 'hari' ? b.hari_aktif - a.hari_aktif : sort === 'setuju' ? approval(b) - approval(a) : b.total - a.total,
  );

  const reporting = rows.filter((b) => b.total > 0).length;
  const lowAttendance = rows.filter((b) => attendance(pct(b)).label === 'Kurang');
  const avgPct = rows.length ? rows.reduce((s, b) => s + pct(b), 0) / rows.length : 0;
  const totalReports = rows.reduce((s, b) => s + b.total, 0);
  const byCategory = CATEGORY_KEYS.map((k) => ({ k, n: rows.reduce((s, b) => s + b[k], 0) })).filter((c) => c.n);

  const href = (patch: Partial<Search>) => withParams('/kinerja', sp, patch);

  return (
    <>
      <PageHeader
        title="Kinerja Bhabinkamtibmas"
        subtitle={`Rekap kegiatan per Bhabin · ${days} hari terakhir`}
        actions={
          <>
            <ExportButton path={`/exports/performance.csv?from=${from}`} />
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
            value={reporting} suffix={`/ ${rows.length}`} footer={`${rows.length ? Math.round((reporting / rows.length) * 100) : 0}% partisipasi`} />
          <StatCard title="Rata-rata hari aktif" description="Hari dengan minimal 1 laporan" icon={<CalendarCheck size={20} />} tone="accent"
            value={`${Math.round(avgPct)}%`} footer={`dari ${span} hari kalender`} />
          <StatCard title="Total laporan" description="Seluruh Bhabin dalam cakupan" icon={<FileStack size={20} />}
            value={totalReports.toLocaleString('id-ID')} footer={`± ${rows.length ? (totalReports / rows.length).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : 0} per Bhabin`} />
          <StatCard alert={lowAttendance.length > 0} title="Kehadiran kurang" description="Hari aktif di bawah 40%" icon={<UserX size={20} />} tone="success"
            value={lowAttendance.length}
            footer={lowAttendance.length ? <span className="font-medium text-danger">{lowAttendance.slice(0, 3).map((b) => b.nama).join(', ')}{lowAttendance.length > 3 ? '…' : ''}</span> : 'semua Bhabin aktif'} />
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
          <PerformanceTable rows={sorted} days={span} sort={sort} hrefFor={(k) => href({ urut: k === 'total' ? undefined : k })} />
        </Card>
      </Stack>
    </>
  );
}
