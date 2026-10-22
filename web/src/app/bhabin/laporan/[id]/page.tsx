import { ArrowLeft, CalendarClock, CheckCircle2, MapPin, PencilLine, Send } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, ButtonLink } from '@/components/ui';
import { slugOf } from '@/features/bhabin/data';
import { AttachmentGallery } from '@/features/reports/attachment-gallery';
import { CategoryIcon } from '@/features/reports/category-icon';
import { ReportFields } from '@/features/reports/report-fields';
import { LocationBadge } from '@/features/reports/status-badge';
import { apiGetOrNotFound } from '@/lib/api/server';
import { CATEGORY_LABEL, tanggalJam } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

export default async function DetailLaporanSayaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await apiGetOrNotFound<ReportDetail>(`/reports/${id}`);
  if (!r) notFound();
  const tz = r.unit.timezone;
  const draft = r.status === 'DRAFT';
  const ralatUntil = r.editableUntil && new Date(r.editableUntil) > new Date() ? r.editableUntil : null;
  const editHref = `/bhabin/lapor/${slugOf(r.category)}?id=${r.id}`;

  return (
    <>
      <Link href="/bhabin/laporan" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Laporan saya</Link>
      {sp.terkirim && <Alert tone="success" title="Laporan terkirim" className="mb-3">Terima kasih. Laporan langsung tercatat; Anda masih bisa meralat dalam 3×24 jam.</Alert>}
      {sp.diralat && <Alert tone="success" title="Ralat tersimpan" className="mb-3">Perubahan laporan sudah tersimpan.</Alert>}
      {sp.tersimpan && <Alert tone="info" title="Draft tersimpan" className="mb-3">Draft belum terkirim. Lanjutkan & kirim bila sudah lengkap.</Alert>}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <CategoryIcon category={r.category} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-primary">{CATEGORY_LABEL[r.category]}</span>
              {draft ? <Badge tone="neutral">Draft</Badge> : <Badge tone="info">Terkirim</Badge>}
              {r.priority && <Badge tone="danger" strong className="text-[10px]">Prioritas</Badge>}
            </div>
            <h1 className="break-all font-mono text-base font-bold">{r.nomor}</h1>
          </div>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-muted" /><dd>{r.village.nama}, {r.village.kecamatan} <span className="ml-1 inline-block align-middle"><LocationBadge insideVillage={r.insideVillage} isMockLocation={r.isMockLocation} /></span></dd></div>
          <div className="flex gap-2"><CalendarClock size={16} className="mt-0.5 shrink-0 text-muted" /><dd>Kegiatan {tanggalJam(r.occurredAt, tz)}</dd></div>
          {r.submittedAt && <div className="flex gap-2"><Send size={16} className="mt-0.5 shrink-0 text-muted" /><dd>Dikirim {tanggalJam(r.submittedAt, tz)}</dd></div>}
        </dl>
        {draft ? (
          <ButtonLink href={editHref} className="mt-4 h-11 w-full" icon={<PencilLine size={17} />}>Lanjutkan & kirim draft</ButtonLink>
        ) : ralatUntil ? (
          <div className="mt-4 rounded-xl border border-line bg-bg p-3">
            <p className="mb-2 text-xs text-muted">Masih bisa diralat hingga <strong className="text-ink">{tanggalJam(ralatUntil, tz)}</strong></p>
            <ButtonLink href={editHref} variant="secondary" className="h-11 w-full" icon={<PencilLine size={17} />}>Ralat laporan</ButtonLink>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 size={14} className="text-success" /> Laporan final — batas ralat sudah lewat.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Isian laporan</h2>
        <ReportFields report={r} />
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Foto & lampiran</h2>
        <AttachmentGallery items={r.attachments} fields={r.schema?.fields ?? []} tz={tz} />
      </section>
    </>
  );
}
