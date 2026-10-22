import { Card, ExportButton, PageHeader, Pagination, Stack } from '@/components/ui';
import { ReportFilters } from '@/features/reports/report-filters';
import { ReportSearch, resolveRange, toApiQuery } from '@/features/reports/report-search';
import { CATEGORY_LABEL, localDayToIso, tanggal } from '@/lib/format';
import { ReportTable } from '@/features/reports/report-table';
import { apiGet, getSessionUser } from '@/lib/api/server';
import type { Paged, ReportListItem } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [10, 20, 50];

function rangeLabel(sp: ReportSearch, tz?: string) {
  const r = resolveRange(sp, tz);
  if (r.preset === 'semua') return 'semua tanggal';
  const fmt = (d?: string) => (d ? tanggal(localDayToIso(d, tz), tz) : '…');
  const span = `${fmt(r.from)} – ${fmt(r.to)}`;
  return r.preset === 'custom' ? span : `${r.preset} hari terakhir (${span})`;
}

export default async function LaporanPage({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const tz = (await getSessionUser())?.unit.timezone;
  const query = toApiQuery(sp, page, limit, tz);
  // Ekspor memakai filter yang sama, tanpa paginasi.
  const exportQuery = (() => {
    const q = new URLSearchParams(query);
    q.delete('page');
    q.delete('limit');
    return q.toString();
  })();

  const { data, meta } = await apiGet<Paged<ReportListItem>>(`/reports?${query}`);
  const firstRow = meta.total ? (page - 1) * limit + 1 : 0;
  const lastRow = Math.min(page * limit, meta.total);
  const categoryTitle = sp.category ? CATEGORY_LABEL[sp.category] : undefined;

  return (
    <>
      <PageHeader
        eyebrow={categoryTitle ? 'Kategori laporan' : 'Pemantauan'}
        title={categoryTitle ?? 'Laporan kegiatan'}
        subtitle={`${categoryTitle ? `Laporan kategori ${categoryTitle.toLowerCase()}` : 'Pantau kegiatan Bhabinkamtibmas di unit Anda'} · ${rangeLabel(sp, tz)}`}
        actions={<ExportButton path={`/exports/reports.csv?${exportQuery}`} />}
      />
      <Stack>
        <Card
          title="Daftar laporan"
          subtitle={`${meta.total.toLocaleString('id-ID')} laporan ditemukan`}
          actions={<span className="whitespace-nowrap rounded-full bg-bg px-2.5 py-1 text-xs font-medium tabular-nums text-muted">{firstRow}–{lastRow} / {meta.total.toLocaleString('id-ID')}</span>}
        >
          <ReportFilters value={sp} tz={tz} />
          <ReportTable rows={data} />
          <Pagination
            page={page}
            limit={limit}
            total={meta.total}
            sizes={SIZES}
            noun="laporan"
            hrefFor={(p, l) => withParams('/laporan', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </Card>
      </Stack>
    </>
  );
}
