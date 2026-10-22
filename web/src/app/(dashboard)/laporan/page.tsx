import { Card, ExportButton, PageHeader, Pagination, Stack } from '@/components/ui';
import { ReportFilters } from '@/features/reports/report-filters';
import { ReportSearch, resolveRange, toApiQuery } from '@/features/reports/report-search';
import { tanggal } from '@/lib/format';
import { ReportTable } from '@/features/reports/report-table';
import { StatusTabs } from '@/features/reports/status-tabs';
import { apiGet } from '@/lib/api/server';
import type { Paged, ReportListItem } from '@/lib/types';
import { withParams } from '@/lib/url';

const SIZES = [10, 20, 50];

function rangeLabel(sp: ReportSearch) {
  const r = resolveRange(sp);
  if (r.preset === 'semua') return 'semua tanggal';
  const fmt = (d?: string) => (d ? tanggal(`${d}T12:00:00+07:00`) : '…');
  const span = `${fmt(r.from)} – ${fmt(r.to)}`;
  return r.preset === 'custom' ? span : `${r.preset} hari terakhir (${span})`;
}

export default async function LaporanPage({ searchParams }: { searchParams: Promise<ReportSearch> }) {
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;
  const query = toApiQuery(sp, page, limit);
  // Ekspor memakai filter yang sama, tanpa paginasi.
  const exportQuery = (() => {
    const q = new URLSearchParams(query);
    q.delete('page');
    q.delete('limit');
    return q.toString();
  })();

  const [{ data, meta }, counts] = await Promise.all([
    apiGet<Paged<ReportListItem>>(`/reports?${query}`),
    apiGet<{ total: number; counts: Record<string, number> }>(`/reports/status-counts?${query}`),
  ]);

  return (
    <>
      <PageHeader
        title="Laporan"
        subtitle={`Laporan kegiatan Bhabinkamtibmas dalam cakupan unit Anda · ${rangeLabel(sp)}`}
        actions={<ExportButton path={`/exports/reports.csv?${exportQuery}`} />}
      />
      <Stack>
        <StatusTabs sp={sp} total={counts.total} counts={counts.counts} />
        <Card>
          <ReportFilters value={sp} />
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
