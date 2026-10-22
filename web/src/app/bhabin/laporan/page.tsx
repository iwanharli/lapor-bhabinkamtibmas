import { FilePlus2, Flame, SearchX } from 'lucide-react';
import Link from 'next/link';
import { ButtonLink, cn, EmptyState, SearchInput } from '@/components/ui';
import { getMe } from '@/features/bhabin/data';
import { ReportFeed } from '@/features/bhabin/report-feed';
import { CategoryIcon } from '@/features/reports/category-icon';
import { apiGet } from '@/lib/api/server';
import { CATEGORY_LABEL, localDateStr, localDayToIso } from '@/lib/format';
import type { Paged, ReportListItem } from '@/lib/types';
import { withParams } from '@/lib/url';

const LIMIT = 20;
type Search = { dibuang?: string; status?: string; kategori?: string; periode?: string; prioritas?: string; q?: string };

const PERIODS = [
  { key: '', label: 'Semua waktu' },
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: 'bulan', label: 'Bulan ini' },
];

export default async function LaporanSayaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, me] = await Promise.all([searchParams, getMe()]);
  const tz = me.unit.timezone;
  const status = sp.status === 'DRAFT' || sp.status === 'SUBMITTED' ? sp.status : undefined;
  const kategori = sp.kategori && CATEGORY_LABEL[sp.kategori] ? sp.kategori : undefined;
  const periode = PERIODS.some((p) => p.key && p.key === sp.periode) ? sp.periode : undefined;
  const prioritas = sp.prioritas === '1';

  const today = localDateStr(0, tz);
  const fromDay = periode === 'bulan' ? `${today.slice(0, 8)}01` : periode ? localDateStr(-(Number(periode) - 1), tz) : undefined;
  const filters = {
    category: kategori, q: sp.q, priority: prioritas ? 'true' : undefined,
    from: fromDay && localDayToIso(fromDay, tz),
  };
  const [{ data, meta }, all, drafts] = await Promise.all([
    apiGet<Paged<ReportListItem>>(withParams('/reports', { ...filters, status, limit: String(LIMIT) })),
    apiGet<Paged<ReportListItem>>(withParams('/reports', { ...filters, limit: '1' })),
    apiGet<Paged<ReportListItem>>(withParams('/reports', { ...filters, status: 'DRAFT', limit: '1' })),
  ]);
  const feedQuery = new URLSearchParams(Object.entries({ ...filters, status }).filter((e): e is [string, string] => !!e[1])).toString();
  const href = (patch: Partial<Search>) => withParams('/bhabin/laporan', sp, { dibuang: undefined, ...patch });
  const filtered = !!(kategori || periode || prioritas || sp.q);


  const tabs = [
    { key: undefined, label: 'Semua', count: all.meta.total },
    { key: 'SUBMITTED', label: 'Terkirim', count: all.meta.total - drafts.meta.total },
    { key: 'DRAFT', label: 'Draft', count: drafts.meta.total },
  ];
  const chip = (on: boolean) => cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
    on ? 'border-transparent bg-primary text-white shadow-sm' : 'border-line bg-surface text-muted hover:text-ink');

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Laporan saya</h1>
          <p className="text-sm text-muted">{meta.total.toLocaleString('id-ID')} laporan{filtered ? ' sesuai filter' : ''}</p>
        </div>
        <ButtonLink href="/bhabin/lapor" size="sm" icon={<FilePlus2 size={15} />}>Buat</ButtonLink>
      </div>

      {sp.dibuang && <p className="mb-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-muted shadow-sm">Draft sudah dibuang.</p>}
      <div className="space-y-2.5">
        <nav aria-label="Status" className="flex rounded-xl bg-line/50 p-1">
          {tabs.map((t) => {
            const on = status === t.key;
            return (
              <Link key={t.label} href={href({ status: t.key })} aria-current={on ? 'page' : undefined}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition', on ? 'bg-surface text-primary shadow-sm' : 'text-muted')}>
                {t.label}
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', t.key === 'DRAFT' && t.count ? 'bg-warn-soft text-warn' : 'bg-bg text-muted')}>{t.count.toLocaleString('id-ID')}</span>
              </Link>
            );
          })}
        </nav>
        <SearchInput placeholder="Cari nomor, desa, atau kepala keluarga…" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <Link href={href({ prioritas: prioritas ? undefined : '1' })} className={cn(chip(prioritas), prioritas && 'bg-danger')}><Flame size={13} /> Prioritas</Link>
          {PERIODS.map((p) => <Link key={p.label} href={href({ periode: p.key || undefined })} className={chip((periode ?? '') === p.key)}>{p.label}</Link>)}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <Link href={href({ kategori: undefined })} className={chip(!kategori)}>Semua kategori</Link>
          {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
            <Link key={k} href={href({ kategori: k })} className={cn(chip(kategori === k), 'py-1 pl-1')}>
              <span className="scale-75"><CategoryIcon category={k} size="sm" /></span>{label}
            </Link>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<SearchX size={22} />} tone="neutral" title="Tidak ada laporan yang cocok" className="py-12">
            <ButtonLink href={withParams('/bhabin/laporan', { status })} variant="secondary" className="mt-3">Hapus filter</ButtonLink>
          </EmptyState>
        ) : (
          <EmptyState icon={<FilePlus2 size={22} />} tone="neutral" title={status === 'DRAFT' ? 'Tidak ada draft' : 'Belum ada laporan'} className="py-12">
            <ButtonLink href="/bhabin/lapor" className="mt-3">Buat laporan</ButtonLink>
          </EmptyState>
        )
      ) : (
        <ReportFeed key={feedQuery} initial={data} total={meta.total} query={feedQuery} limit={LIMIT} tz={tz} />
      )}

    </>
  );
}
