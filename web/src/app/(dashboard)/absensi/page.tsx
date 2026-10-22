import { UserCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cn, EmptyState, PageHeader, Pagination, SearchInput, Stack } from '@/components/ui';
import { AttendanceTable } from '@/features/attendance/attendance-table';
import { DateFilter } from '@/features/attendance/date-filter';
import { AttendanceOverview, LowestUnits } from '@/features/attendance/overview';
import type { AttendanceDaily } from '@/features/attendance/types';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';
import { withParams } from '@/lib/url';

const SIZES = [20, 50, 100];
type Search = { tanggal?: string; unitId?: string; q?: string; status?: string; page?: string; limit?: string };

const tanggalPanjang = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function AbsensiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getSessionUser();
  if (me?.role === 'BHABIN') redirect('/bhabin/absensi');

  const sp = await searchParams;
  const today = localDateStr(0, me?.unit.timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= today ? sp.tanggal! : today;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const res = await apiGet<AttendanceDaily>(
    withParams('/attendances/daily', { date, unitId: sp.unitId, q: sp.q, status: sp.status, page: String(page), limit: String(limit) }),
  );
  const s = res.summary;
  const href = (patch: Partial<Search>) => withParams('/absensi', sp, { page: undefined, ...patch });
  const tabs = [
    { key: '', label: 'Semua', count: s.bhabin, dot: 'bg-primary' },
    { key: 'hadir', label: 'Hadir', count: s.hadir, dot: 'bg-success' },
    { key: 'terlambat', label: 'Terlambat', count: s.terlambat, dot: 'bg-warn' },
    { key: 'belum', label: 'Belum hadir', count: s.bhabin - s.hadir, dot: 'bg-danger' },
    { key: 'luar', label: 'Lokasi dicek', count: s.luar + s.palsu, dot: 'bg-accent' },
  ];

  return (
    <>
      <PageHeader
        title="Absensi Lapangan"
        subtitle={`${tanggalPanjang(date)}${date === today ? ' · hari ini' : ''} · absen masuk & pulang Bhabinkamtibmas dengan GPS dan swafoto`}
        actions={<DateFilter date={date} today={today} />}
      />
      <Stack>
        <AttendanceOverview res={res} href={(status) => href({ status })} />
        <LowestUnits units={res.lowestUnits} href={(unitId) => href({ unitId, status: 'belum' })} />

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
            <nav aria-label="Status kehadiran" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
              {tabs.map((t) => {
                const on = (sp.status ?? '') === t.key;
                return (
                  <Link key={t.key || 'all'} href={href({ status: t.key || undefined })} aria-current={on ? 'page' : undefined}
                    className={cn('inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition', on ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-bg hover:text-ink')}>
                    {!on && <span className={cn('h-2 w-2 rounded-full', t.dot)} />}
                    {t.label}
                    <span className={cn('rounded-full px-1.5 text-xs tabular-nums', on ? 'bg-white/20' : 'bg-bg')}>{t.count.toLocaleString('id-ID')}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput placeholder="Cari NRP atau nama Bhabin…" className="flex-1" />
              <UrlUnitFilter />
            </div>
          </div>
          {res.data.length === 0 ? (
            <EmptyState icon={<UserCheck size={22} />} tone="neutral" title="Tidak ada data" className="py-14">Tidak ada Bhabin yang cocok dengan filter ini.</EmptyState>
          ) : (
            <AttendanceTable rows={res.data} />
          )}
          <Pagination
            page={page}
            limit={limit}
            total={res.meta.total}
            sizes={SIZES}
            noun="Bhabin"
            hrefFor={(p, l) => withParams('/absensi', sp, { page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </section>
      </Stack>
    </>
  );
}
