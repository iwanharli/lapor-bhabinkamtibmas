import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert } from '@/components/ui';
import { activeSchemas, categoryOf, getCommodities, getMe } from '@/features/bhabin/data';
import { type FormSchema, ReportForm } from '@/features/bhabin/report-form';
import { CategoryIcon } from '@/features/reports/category-icon';
import { apiGetOrNotFound } from '@/lib/api/server';
import type { ReportDetail } from '@/lib/types';

export default async function IsiLaporanPage({ params, searchParams }: { params: Promise<{ kategori: string }>; searchParams: Promise<{ id?: string }> }) {
  const [{ kategori }, { id }] = await Promise.all([params, searchParams]);
  const category = categoryOf(kategori);
  const [schemas, me, commodities, report] = await Promise.all([
    activeSchemas(), getMe(), getCommodities(), id ? apiGetOrNotFound<ReportDetail>(`/reports/${id}`) : Promise.resolve(undefined),
  ]);
  if (id && !report) notFound();
  // Draft/ralat memakai skema laporan itu sendiri (bisa versi lama).
  const schema = report?.schema
    ? { ...(report.schema as unknown as FormSchema), category: report.category, version: report.schemaVersion }
    : schemas.find((s) => s.category === category);
  if (!schema) notFound();
  if (report) {
    const editable = report.status === 'DRAFT' || (report.editableUntil && new Date(report.editableUntil) > new Date());
    if (!editable) redirect(`/bhabin/laporan/${report.id}`);
  }
  const villages = me.villages.map((v) => v.village);

  return (
    <>
      <Link href={report ? `/bhabin/laporan/${report.id}` : '/bhabin/lapor'} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Kembali</Link>
      <div className="mb-4 flex items-center gap-3">
        <CategoryIcon category={schema.category} size="md" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">{report?.status === 'SUBMITTED' ? 'Ralat laporan' : report ? 'Lanjutkan draft' : 'Laporan baru'}</h1>
          <p className="truncate text-sm text-muted">{schema.title}{report ? ` · ${report.nomor}` : ''}</p>
        </div>
      </div>
      {villages.length === 0 ? (
        <Alert tone="warn" title="Belum ada desa binaan">Hubungi admin unit untuk menetapkan desa binaan Anda sebelum membuat laporan.</Alert>
      ) : (
        <ReportForm schema={schema} villages={villages} commodities={commodities} report={report ?? undefined} />
      )}
    </>
  );
}
