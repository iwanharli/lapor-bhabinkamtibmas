import { AlarmClock, CalendarCheck, CircleCheck, CircleDashed, Clock, LogIn, LogOut, MapPinX } from 'lucide-react';
import { cn } from '@/components/ui';
import { AttendancePanel, type MyAttendance } from '@/features/bhabin/attendance-panel';
import { getMe } from '@/features/bhabin/data';
import { apiGet } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';

const LATE_AFTER = '08:00';
const DAYS = 14;

/** Menit sejak tengah malam (waktu setempat). */
const minutes = (iso: string, tz: string) => {
  const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}.${String(Math.round(min % 60)).padStart(2, '0')}`;
const durasi = (min: number) => `${Math.floor(min / 60)} j ${String(Math.round(min % 60)).padStart(2, '0')} m`;
const LATE_MIN = Number(LATE_AFTER.split(':')[0]) * 60 + Number(LATE_AFTER.split(':')[1]);

export default async function AbsensiSayaPage() {
  const [me, rows] = await Promise.all([getMe(), apiGet<MyAttendance[]>('/attendances/me')]);
  const tz = me.unit.timezone;
  const today = localDateStr(0, tz);
  const byDay = new Map<string, MyAttendance[]>();
  for (const a of rows) byDay.set(a.workDate, [...(byDay.get(a.workDate) ?? []), a]);

  // 14 hari terakhir sebelum hari ini, termasuk hari tanpa absen.
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = localDateStr(-(i + 1), tz);
    const list = byDay.get(d) ?? [];
    const ci = list.find((a) => a.type === 'CHECK_IN');
    const co = list.find((a) => a.type === 'CHECK_OUT');
    const masuk = ci ? minutes(ci.clientTime, tz) : null;
    const pulang = co ? minutes(co.clientTime, tz) : null;
    return {
      d, masuk, pulang,
      late: masuk != null && masuk > LATE_MIN,
      flagged: list.some((a) => a.isMockLocation || a.insideVillage === false),
      dur: masuk != null && pulang != null ? pulang - masuk : null,
    };
  });
  const hadir = days.filter((x) => x.masuk != null);
  const tepat = hadir.filter((x) => !x.late).length;
  const avgIn = hadir.length ? hadir.reduce((n, x) => n + x.masuk!, 0) / hadir.length : null;
  const withDur = hadir.filter((x) => x.dur != null);
  const avgDur = withDur.length ? withDur.reduce((n, x) => n + x.dur!, 0) / withDur.length : null;

  const stats = [
    { icon: CalendarCheck, label: 'Hari hadir', value: `${hadir.length}/${DAYS}`, cls: 'bg-primary/10 text-primary' },
    { icon: CircleCheck, label: 'Tepat waktu', value: hadir.length ? `${Math.round((tepat / hadir.length) * 100)}%` : '—', cls: 'bg-success/10 text-success' },
    { icon: LogIn, label: 'Rata-rata masuk', value: avgIn != null ? hhmm(avgIn) : '—', cls: 'bg-accent/10 text-accent' },
    { icon: Clock, label: 'Rata-rata durasi', value: avgDur != null ? durasi(avgDur) : '—', cls: 'bg-warn/10 text-warn' },
  ];

  return (
    <>
      <h1 className="text-xl font-bold">Absensi</h1>
      <p className="mb-4 text-sm text-muted">{new Date().toLocaleDateString('id-ID', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <AttendancePanel today={byDay.get(today) ?? []} tz={tz} lateAfter={LATE_AFTER} />

      <h2 className="mb-2 mt-6 text-sm font-semibold">Ringkasan {DAYS} hari</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <span className={cn('grid h-8 w-8 place-items-center rounded-lg', s.cls)}><s.icon size={16} /></span>
            <span className="mt-2 block whitespace-nowrap text-lg font-bold leading-tight tabular-nums">{s.value}</span>
            <span className="block text-xs leading-snug text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Riwayat</h2>
      <ul className="space-y-2">
        {days.map((x) => {
          const date = new Date(`${x.d}T00:00:00Z`);
          const status = x.masuk == null
            ? { label: 'Tidak hadir', icon: CircleDashed, cls: 'bg-danger-soft text-danger', bar: 'bg-danger/60' }
            : x.late
              ? { label: 'Terlambat', icon: AlarmClock, cls: 'bg-warn-soft text-warn', bar: 'bg-warn' }
              : { label: 'Tepat waktu', icon: CircleCheck, cls: 'bg-success-soft text-success', bar: 'bg-success' };
          return (
            <li key={x.d} className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-3 pl-4 shadow-sm">
              <span className={cn('absolute inset-y-0 left-0 w-1', status.bar)} />
              <span className="grid w-11 shrink-0 text-center leading-tight">
                <span className="text-[10px] font-semibold uppercase text-muted">{date.toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'short' })}</span>
                <span className="text-lg font-bold tabular-nums">{date.getUTCDate()}</span>
                <span className="text-[10px] text-muted">{date.toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'short' })}</span>
              </span>
              <span className="min-w-0 flex-1">
                {x.masuk == null ? (
                  <span className="text-sm text-muted">Tidak ada absen</span>
                ) : (
                  <>
                    <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                      <span className="inline-flex items-center gap-1"><LogIn size={14} className="text-muted" />{hhmm(x.masuk)}</span>
                      <span className="text-muted/50">→</span>
                      <span className="inline-flex items-center gap-1"><LogOut size={14} className="text-muted" />{x.pulang != null ? hhmm(x.pulang) : '—'}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {x.dur != null ? durasi(x.dur) : 'belum absen pulang'}
                      {x.flagged && <span className="inline-flex items-center gap-0.5 text-danger"><MapPinX size={12} /> lokasi</span>}
                    </span>
                  </>
                )}
              </span>
              <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium', status.cls)}>
                <status.icon size={12} /> {status.label}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
