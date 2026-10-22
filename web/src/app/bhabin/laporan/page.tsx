import { FilePlus2 } from 'lucide-react';
import Link from 'next/link';
import { ButtonLink, cn, EmptyState } from '@/components/ui';
import { ReportCard } from '@/features/bhabin/report-card';
import { apiGet } from '@/lib/api/server';
import type { Paged, ReportListItem } from '@/lib/types';

const LIMIT = 20;

export default async function LaporanSayaPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === 'DRAFT' ? 'DRAFT' : undefined;
  const page = Math.max(Number(sp.page) || 1, 1);
  const q = new URLSearchParams({ limit: String(LIMIT), page: String(page), ...(status && { status }) });
  const [{ data, meta }, drafts] = await Promise.all([
    apiGet<Paged<ReportListItem>>(`/reports?${q}`),
    apiGet<Paged<ReportListItem>>('/reports?status=DRAFT&limit=1'),
  ]);
  const pages = Math.max(Math.ceil(meta.total / LIMIT), 1);
  const tab = (label: string, href: string, on: boolean, count?: number) => (
    <Link href={href} className={cn('flex-1 rounded-lg py-2 text-center text-sm font-medium transition', on ? 'bg-surface text-primary shadow-sm' : 'text-muted')}>
      {label}{count ? <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 text-[11px] text-warn">{count}</span> : null}
    </Link>
  );

  return (
    <>
      <h1 className="text-xl font-bold">Laporan saya</h1>
      <p className="mb-4 text-sm text-muted">{meta.total.toLocaleString('id-ID')} laporan{status ? ' draft' : ''}</p>
      <nav className="mb-4 flex rounded-xl bg-line/50 p-1">
        {tab('Semua', '/bhabin/laporan', !status)}
        {tab('Draft', '/bhabin/laporan?status=DRAFT', !!status, drafts.meta.total)}
      </nav>
      {data.length === 0 ? (
        <EmptyState icon={<FilePlus2 size={22} />} tone="neutral" title={status ? 'Tidak ada draft' : 'Belum ada laporan'} className="py-12">
          <ButtonLink href="/bhabin/lapor" className="mt-3">Buat laporan</ButtonLink>
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">{data.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}</ul>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link aria-disabled={page <= 1} href={`/bhabin/laporan?${new URLSearchParams({ ...(status && { status }), page: String(page - 1) })}`} className={cn('rounded-lg border border-line px-3 py-2', page <= 1 && 'pointer-events-none opacity-40')}>‹ Sebelumnya</Link>
          <span className="text-muted">Hal. {page} / {pages}</span>
          <Link aria-disabled={page >= pages} href={`/bhabin/laporan?${new URLSearchParams({ ...(status && { status }), page: String(page + 1) })}`} className={cn('rounded-lg border border-line px-3 py-2', page >= pages && 'pointer-events-none opacity-40')}>Berikutnya ›</Link>
        </div>
      )}
    </>
  );
}
