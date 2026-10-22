import { ArrowLeft, CalendarClock, CheckCircle2, Clock, FilePen, Hash, MapPin, PencilLine, Send, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink, cn } from '@/components/ui';
import { slugOf } from '@/features/bhabin/data';
import { DiscardDraft } from '@/features/bhabin/discard-draft';
import { ReportSections } from '@/features/bhabin/report-sections';
import { AttachmentGallery } from '@/features/reports/attachment-gallery';
import { categoryGlyph } from '@/features/reports/category-icon';
import { LocationBadge } from '@/features/reports/status-badge';
import { apiGetOrNotFound } from '@/lib/api/server';
import { CATEGORY_LABEL, jarak, tanggalJam } from '@/lib/format';
import type { ReportDetail } from '@/lib/types';

/** Pesan setelah aksi (kirim/ralat/draft) dari parameter URL. */
const NOTICE: Record<string, { title: string; text: string; icon: typeof CheckCircle2; cls: string }> = {
  terkirim: { title: 'Laporan terkirim', text: 'Laporan langsung tercatat. Anda masih bisa meralat dalam 3×24 jam.', icon: CheckCircle2, cls: 'border-success/30 bg-success-soft/60 text-success' },
  diralat: { title: 'Ralat tersimpan', text: 'Perubahan laporan sudah tersimpan.', icon: CheckCircle2, cls: 'border-success/30 bg-success-soft/60 text-success' },
  tersimpan: { title: 'Draft tersimpan', text: 'Belum terkirim. Lanjutkan & kirim bila sudah lengkap.', icon: FilePen, cls: 'border-[var(--brand)]/25 bg-primary-soft/60 text-primary' },
};

export default async function DetailLaporanSayaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await apiGetOrNotFound<ReportDetail>(`/reports/${id}`);
  if (!r) notFound();
  const tz = r.unit.timezone;
  const draft = r.status === 'DRAFT';
  const ralatUntil = r.editableUntil && new Date(r.editableUntil) > new Date() ? r.editableUntil : null;
  const editHref = `/bhabin/lapor/${slugOf(r.category)}?id=${r.id}`;
  const notice = Object.keys(NOTICE).find((k) => sp[k]);
  const n = notice ? NOTICE[notice] : null;
  const Glyph = categoryGlyph(r.category);

  return (
    <>
      <Link href="/bhabin/laporan" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Laporan saya</Link>

      {n && (
        <div className={cn('mb-3 flex items-center gap-3 rounded-2xl border p-3.5', n.cls)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-current/10"><n.icon size={22} /></span>
          <div className="min-w-0 text-ink">
            <p className="text-sm font-semibold">{n.title}</p>
            <p className="text-xs text-muted">{n.text}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="relative bg-gradient-to-br from-[var(--brand-deep)] via-[var(--brand)] to-[var(--brand-2)] p-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><Glyph size={24} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{CATEGORY_LABEL[r.category]}</p>
              <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-black/15 px-1.5 py-0.5 font-mono text-[11px] text-white/85"><Hash size={11} className="shrink-0" /><span className="truncate">{r.nomor}</span></p>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', draft ? 'bg-white/15 text-white' : 'bg-white text-emerald-700')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', draft ? 'bg-white/70' : 'bg-emerald-500')} />
              {draft ? 'Draft' : 'Terkirim'}
            </span>
          </div>
          {r.priority && <p className="relative mt-2 inline-block rounded-full bg-red-500/90 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">Prioritas</p>}
        </div>

        <dl className="divide-y divide-line/70 text-sm">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <MapPin size={16} className="shrink-0 text-muted" />
            <dd className="min-w-0 flex-1 truncate">{r.village.nama}, {r.village.kecamatan}</dd>
            {!draft && <LocationBadge insideVillage={r.insideVillage} isMockLocation={r.isMockLocation} distanceM={r.distanceM} />}
          </div>
          {!draft && (r.insideVillage === false || r.isMockLocation) && (
            <div className="flex gap-3 bg-warn-soft/50 px-4 py-2.5 text-xs leading-relaxed">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
              <dd className="text-ink/80">
                {r.isMockLocation
                  ? 'Perangkat terdeteksi memakai lokasi palsu.'
                  : r.distanceM != null ? `Titik GPS laporan berada ±${jarak(r.distanceM)} dari batas desa ${r.village.nama} (toleransi 200 m).` : `Titik GPS laporan berada di luar batas desa ${r.village.nama} (toleransi 200 m).`}{' '}
                Laporan tetap tercatat; pimpinan diberi tahu untuk mengecek lokasinya.
              </dd>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-2.5"><CalendarClock size={16} className="shrink-0 text-muted" /><dd>Kegiatan {tanggalJam(r.occurredAt, tz)}</dd></div>
          {r.submittedAt && <div className="flex items-center gap-3 px-4 py-2.5"><Send size={16} className="shrink-0 text-muted" /><dd>Dikirim {tanggalJam(r.submittedAt, tz)}</dd></div>}
        </dl>

        <div className="border-t border-line p-3">
          {draft ? (
            <div className="flex gap-2">
              <DiscardDraft id={r.id} className="h-11 shrink-0" />
              <ButtonLink href={editHref} className="h-11 flex-1" icon={<PencilLine size={17} />}>Lanjutkan & kirim draft</ButtonLink>
            </div>
          ) : ralatUntil ? (
            <div className="flex items-center gap-3">
              <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted"><Clock size={14} className="shrink-0" /><span>Bisa diralat hingga <strong className="text-ink">{tanggalJam(ralatUntil, tz)}</strong></span></p>
              <ButtonLink href={editHref} variant="secondary" size="sm" icon={<PencilLine size={15} />}>Ralat</ButtonLink>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 size={14} className="text-success" /> Laporan final — batas ralat sudah lewat.</p>
          )}
        </div>
      </section>

      <h2 className="mb-2 mt-5 text-sm font-semibold">Isian laporan</h2>
      <ReportSections report={r} />

      {r.attachments.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-semibold">Foto & lampiran</h2>
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <AttachmentGallery items={r.attachments} fields={r.schema?.fields ?? []} tz={tz} />
          </section>
        </>
      )}
    </>
  );
}
