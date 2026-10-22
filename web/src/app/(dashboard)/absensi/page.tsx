import { AlarmClock, MapPinX, UserCheck, UserX } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Card, CountTabs, EmptyState, PageHeader, Pagination, SearchInput, Stack, StatCard } from '@/components/ui';
import { AttendanceTable } from '@/features/attendance/attendance-table';
import { DateFilter } from '@/features/attendance/date-filter';
import type { AttendanceDaily } from '@/features/attendance/types';
import { UrlUnitFilter } from '@/features/units/unit-combobox';
import { apiGet, getSessionUser } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';
import { withParams } from '@/lib/url';

const SIZES = [20, 50, 100];
type Search = { tanggal?: string; unitId?: string; q?: string; status?: string; page?: string; limit?: string };

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const tanggalPanjang = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function AbsensiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getSessionUser();
  if (me?.role === 'BHABIN') redirect('/laporan');

  const sp = await searchParams;
  const today = localDateStr(0, me?.unit.timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? '') && sp.tanggal! <= today ? sp.tanggal! : today;
  const page = Math.max(Number(sp.page) || 1, 1);
  const limit = SIZES.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const res = await apiGet<AttendanceDaily>(
    withParams('/attendances/daily', { date, unitId: sp.unitId, q: sp.q, status: sp.status, page: String(page), limit: String(limit) }),
  );
  const { summary: s } = res;
  const belum = s.bhabin - s.hadir;
  const href = (patch: Partial<Search>) => withParams('/absensi', sp, patch);

  return (
    <>
      <PageHeader
        title="Absensi Lapangan"
        subtitle={`${tanggalPanjang(date)} · check-in & check-out Bhabinkamtibmas dengan GPS dan swafoto`}
        actions={<DateFilter date={date} today={today} />}
      />
      <Stack>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
          <StatCard title="Hadir" description="Sudah check-in" icon={<UserCheck size={20} />} tone="success"
            value={s.hadir} suffix={`/ ${s.bhabin}`} footer={`${pct(s.hadir, s.bhabin)}% Bhabin · ${s.pulang} sudah check-out`} />
          <StatCard alert={belum > 0} title="Belum hadir" description="Belum check-in" icon={<UserX size={20} />} tone="success"
            value={belum} footer={belum ? `${pct(belum, s.bhabin)}% Bhabin` : 'semua Bhabin hadir'} />
          <StatCard title="Terlambat" description={`Check-in setelah ${res.lateAfter.replace(':', '.')} setempat`} icon={<AlarmClock size={20} />} tone="accent"
            value={s.terlambat} footer={s.hadir ? `${pct(s.terlambat, s.hadir)}% dari yang hadir` : '—'} />
          <StatCard alert={s.luar + s.palsu > 0} title="Lokasi perlu dicek" description="Di luar desa binaan / lokasi palsu" icon={<MapPinX size={20} />} tone="success"
            value={s.luar + s.palsu} footer={`${s.luar} di luar desa · ${s.palsu} lokasi palsu`} />
        </div>

        <CountTabs
          active={sp.status ?? ''}
          tabs={[
            { key: '', label: 'Semua', count: s.bhabin, href: href({ status: undefined, page: undefined }) },
            { key: 'hadir', label: 'Hadir', count: s.hadir, href: href({ status: 'hadir', page: undefined }), dot: 'bg-success' },
            { key: 'belum', label: 'Belum hadir', count: belum, href: href({ status: 'belum', page: undefined }), dot: 'bg-danger' },
            { key: 'terlambat', label: 'Terlambat', count: s.terlambat, href: href({ status: 'terlambat', page: undefined }), dot: 'bg-warn' },
            { key: 'luar', label: 'Lokasi perlu dicek', count: s.luar + s.palsu, href: href({ status: 'luar', page: undefined }), dot: 'bg-accent' },
          ]}
        />

        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <SearchInput placeholder="Cari NRP atau nama Bhabin…" className="flex-1" />
            <UrlUnitFilter />
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
            hrefFor={(p, l) => href({ page: p > 1 ? String(p) : undefined, limit: l !== 20 ? String(l) : undefined })}
          />
        </Card>
      </Stack>
    </>
  );
}
