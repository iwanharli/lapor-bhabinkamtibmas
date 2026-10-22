import { AttendancePanel, type MyAttendance } from '@/features/bhabin/attendance-panel';
import { getMe } from '@/features/bhabin/data';
import { apiGet } from '@/lib/api/server';
import { localDateStr } from '@/lib/format';

const LATE_AFTER = '08:00';
const jam = (iso: string, tz: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
const hari = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

export default async function AbsensiSayaPage() {
  const [me, rows] = await Promise.all([getMe(), apiGet<MyAttendance[]>('/attendances/me')]);
  const tz = me.unit.timezone;
  const today = localDateStr(0, tz);
  const byDay = new Map<string, MyAttendance[]>();
  for (const a of rows) byDay.set(a.workDate, [...(byDay.get(a.workDate) ?? []), a]);
  const history = [...byDay.entries()].filter(([d]) => d !== today).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);

  return (
    <>
      <h1 className="text-xl font-bold">Absensi</h1>
      <p className="mb-4 text-sm text-muted">{new Date().toLocaleDateString('id-ID', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <AttendancePanel today={byDay.get(today) ?? []} tz={tz} lateAfter={LATE_AFTER} />

      <h2 className="mb-2 mt-6 text-sm font-semibold">Riwayat 14 hari</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {history.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Belum ada riwayat absensi.</li>}
        {history.map(([d, list]) => {
          const ci = list.find((a) => a.type === 'CHECK_IN');
          const co = list.find((a) => a.type === 'CHECK_OUT');
          const late = ci && jam(ci.clientTime, tz) > LATE_AFTER;
          const flagged = list.some((a) => a.isMockLocation || a.insideVillage === false);
          return (
            <li key={d} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-24 shrink-0 text-muted">{hari(d)}</span>
              <span className="flex-1 tabular-nums">
                {ci ? jam(ci.clientTime, tz) : '—'} <span className="text-muted">→</span> {co ? jam(co.clientTime, tz) : '—'}
              </span>
              {late && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">terlambat</span>}
              {flagged && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] text-danger">lokasi</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
