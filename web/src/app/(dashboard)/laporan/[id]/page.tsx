import { ImageOff } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BackLink, Card, EmptyState, SplitLayout, Stack } from '@/components/ui';
import { LocationInfo } from '@/features/reports/location-info';
import { PriceItemsTable } from '@/features/reports/price-items-table';
import { ReportFields } from '@/features/reports/report-fields';
import { ReportHeader } from '@/features/reports/report-header';
import { ReviewNote } from '@/features/reports/review-note';
import { StatusStepper } from '@/features/reports/status-stepper';
import { StatusTimeline } from '@/features/reports/status-timeline';
import { apiGet, apiGetOrNotFound } from '@/lib/api/server';
import type { LatestPrice, ReportDetail } from '@/lib/types';

export default async function LaporanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiGetOrNotFound<ReportDetail>(`/reports/${id}`);
  if (!r) notFound();

  const decidable = r.canReview && (r.status === 'SUBMITTED' || r.status === 'IN_REVIEW');
  // Pembanding harga wilayah hanya untuk laporan harga pangan.
  const averages = r.items.length ? await apiGet<LatestPrice[]>('/analytics/prices/latest').catch(() => undefined) : undefined;

  return (
    <>
      <BackLink href="/laporan" />
      <Stack>
        <ReportHeader report={r} decidable={decidable} />
        <ReviewNote report={r} />

        <SplitLayout
          asideSticky
          aside={
            <>
              <Card title="Lokasi & bukti" subtitle="Titik GPS saat laporan dibuat">
                <LocationInfo report={r} />
              </Card>
              <Card title="Riwayat" subtitle={`${r.history.length} perubahan status`}>
                <StatusTimeline history={r.history} />
              </Card>
            </>
          }
        >
          <Card title="Alur verifikasi">
            <StatusStepper report={r} />
          </Card>
          <Card title="Isian laporan" subtitle={r.schema?.title}>
            <ReportFields report={r} />
          </Card>
          {r.items.length > 0 && (
            <Card title="Harga komoditas" subtitle={`${r.items.length} komoditas · dibanding rata-rata 7 hari di wilayah Anda; selisih ≥10% disorot`}>
              <PriceItemsTable items={r.items} averages={averages} />
            </Card>
          )}
          <Card title="Lampiran" subtitle="Foto & dokumen bukti kegiatan">
            {r.attachments.length === 0 ? (
              <EmptyState icon={<ImageOff size={22} />} tone="neutral" title="Belum ada lampiran">
                Foto dari aplikasi mobile akan tampil di sini setelah modul unggah lampiran aktif.
              </EmptyState>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">{r.attachments.length} lampiran</p>
            )}
          </Card>
        </SplitLayout>
      </Stack>
    </>
  );
}
