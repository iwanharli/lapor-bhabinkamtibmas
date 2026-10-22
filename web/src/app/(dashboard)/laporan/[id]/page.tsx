import { notFound } from 'next/navigation';
import { BackLink, Card, SplitLayout, Stack } from '@/components/ui';
import { AttachmentGallery } from '@/features/reports/attachment-gallery';
import { LocationInfo } from '@/features/reports/location-info';
import { PriceItemsTable } from '@/features/reports/price-items-table';
import { ReportFields } from '@/features/reports/report-fields';
import { ReportHeader } from '@/features/reports/report-header';
import { StatusTimeline } from '@/features/reports/status-timeline';
import { apiGet, apiGetOrNotFound } from '@/lib/api/server';
import type { LatestPrice, ReportDetail } from '@/lib/types';

export default async function LaporanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiGetOrNotFound<ReportDetail>(`/reports/${id}`);
  if (!r) notFound();

  // Pembanding harga wilayah hanya untuk laporan harga pangan.
  const averages = r.items.length ? await apiGet<LatestPrice[]>('/analytics/prices/latest').catch(() => undefined) : undefined;

  return (
    <>
      <BackLink href="/laporan" />
      <Stack>
        <ReportHeader report={r} />

        <SplitLayout
          asideSticky
          aside={
            <>
              <Card title="Lokasi & bukti" subtitle="Titik GPS saat laporan dibuat">
                <LocationInfo report={r} />
              </Card>
              <Card title="Riwayat" subtitle={`${r.history.length} perubahan status`}>
                <StatusTimeline history={r.history} tz={r.unit.timezone} />
              </Card>
            </>
          }
        >
          <Card title="Isian laporan" subtitle={r.schema?.title}>
            <ReportFields report={r} />
          </Card>
          {r.items.length > 0 && (
            <Card title="Harga komoditas" subtitle={`${r.items.length} komoditas · dibanding rata-rata 7 hari di wilayah Anda; selisih ≥10% disorot`}>
              <PriceItemsTable items={r.items} averages={averages} />
            </Card>
          )}
          <Card title="Lampiran" subtitle={r.attachments.length ? `${r.attachments.length} berkas · klik foto untuk memperbesar` : 'Foto & dokumen bukti kegiatan'}>
            <AttachmentGallery items={r.attachments} fields={r.schema?.fields ?? []} tz={r.unit.timezone} />
          </Card>
        </SplitLayout>
      </Stack>
    </>
  );
}
