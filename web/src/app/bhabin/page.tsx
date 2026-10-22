import { ChevronRight, LogIn, LogOut, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui';
import type { MyAttendance } from '@/features/bhabin/attendance-panel';
import { activeSchemas, getMe, slugOf } from '@/features/bhabin/data';
import { ReportCard } from '@/features/bhabin/report-card';
import { CategoryIcon } from '@/features/reports/category-icon';
import { apiGet } from '@/lib/api/server';
import { localDateStr, localDayToIso } from '@/lib/format';
import type { Paged, ReportListItem } from '@/lib/types';

const SHORT: Record<string, string> = {
  SAMBANG: 'Sambang', DETEKSI_DINI: 'Deteksi Dini', PROBLEM_SOLVING: 'Problem Solving',
  HARGA_PANGAN: 'Harga Pangan', MAPPING_KK: 'Mapping Data Keluarga', KETAHANAN_PANGAN: 'Ketahanan Pangan',
};

function salam(tz: string) {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}

export default async function BerandaBhabinPage() {
  const me = await getMe();
  const tz = me.unit.timezone;
  const today = localDateStr(0, tz);
  const month = `${today.slice(0, 8)}01`;
  const [schemas, attendance, recent, week, thisMonth, drafts] = await Promise.all([
    activeSchemas(),
    apiGet<MyAttendance[]>('/attendances/me'),
    apiGet<Paged<ReportListItem>>('/reports?limit=5'),
    apiGet<Paged<ReportListItem>>(`/reports?status=SUBMITTED&limit=1&from=${encodeURIComponent(localDayToIso(localDateStr(-6, tz), tz))}`),
    apiGet<Paged<ReportListItem>>(`/reports?status=SUBMITTED&limit=1&from=${encodeURIComponent(localDayToIso(month, tz))}`),
    apiGet<Paged<ReportListItem>>('/reports?status=DRAFT&limit=1'),
  ]);
  const checkIn = attendance.find((a) => a.workDate === today && a.type === 'CHECK_IN');
  const checkOut = attendance.find((a) => a.workDate === today && a.type === 'CHECK_OUT');
  const jam = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-deep)] via-[var(--brand)] to-[var(--brand-2)] p-4 text-white shadow-lg shadow-primary/20">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm text-white/80">{salam(tz)},</p>
        <h1 className="text-lg font-bold leading-tight">{[me.pangkat, me.nama].filter(Boolean).join(' ')}</h1>
        <p className="mt-0.5 text-xs text-white/75">Desa binaan: {me.villages.map((v) => v.village.nama).join(', ') || '—'}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[['7 hari', week.meta.total], ['Bulan ini', thisMonth.meta.total], ['Draft', drafts.meta.total]].map(([l, n]) => (
            <div key={l} className="rounded-xl bg-white/12 px-2 py-2 ring-1 ring-white/15">
              <p className="text-xl font-bold tabular-nums">{Number(n).toLocaleString('id-ID')}</p>
              <p className="text-[11px] text-white/75">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/bhabin/absensi" className={cn('mt-3 flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition active:scale-[0.99]', checkIn ? 'border-success/30 bg-success-soft/40' : 'border-warn/40 bg-warn-soft/50')}>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', checkIn ? 'bg-success/15 text-success' : 'bg-warn/15 text-warn')}><UserCheck size={20} /></span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold">{!checkIn ? 'Belum absen masuk hari ini' : !checkOut ? 'Sudah absen masuk' : 'Absensi hari ini lengkap'}</span>
          <span className="flex items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><LogIn size={12} /> {checkIn ? jam(checkIn.clientTime) : '—'}</span>
            <span className="inline-flex items-center gap-1"><LogOut size={12} /> {checkOut ? jam(checkOut.clientTime) : '—'}</span>
          </span>
        </span>
        <ChevronRight size={18} className="text-muted" />
      </Link>

      <h2 className="mb-2 mt-5 text-sm font-semibold">Buat laporan</h2>
      <div className="grid grid-cols-3 gap-2.5">
        {schemas.map((s) => (
          <Link key={s.category} href={`/bhabin/lapor/${slugOf(s.category)}`} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-3 text-center shadow-sm transition active:scale-[0.97] hover:border-primary/40">
            <CategoryIcon category={s.category} />
            <span className="text-[11px] font-medium leading-tight">{SHORT[s.category] ?? s.title}</span>
          </Link>
        ))}
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Laporan terbaru</h2>
        <Link href="/bhabin/laporan" className="text-xs font-semibold text-primary">Lihat semua</Link>
      </div>
      {recent.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Belum ada laporan. Mulai dengan memilih jenis laporan di atas.</p>
      ) : (
        <ul className="space-y-2.5">{recent.data.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}</ul>
      )}
    </>
  );
}
