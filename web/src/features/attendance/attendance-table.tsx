import { AlarmClock, CircleCheck, CircleDashed, CloudOff, LogIn, LogOut, MapPinCheck, MapPinX, ShieldAlert } from 'lucide-react';
import { Avatar, cn, Table, Td, Th, THead, Tr } from '@/components/ui';
import { personName, tzLabel } from '@/lib/format';
import type { AttendanceRow } from './types';

const jam = (iso: string | null, tz: string) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' }) : null);
const km = (m: number | null) => (m == null ? '' : m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);
const durasi = (m: number | null) => (m == null ? null : `${Math.floor(m / 60)} j ${String(m % 60).padStart(2, '0')} m`);

/** Status tunggal per Bhabin untuk chip: belum hadir / terlambat / tepat waktu. */
function Status({ r }: { r: AttendanceRow }) {
  const s = !r.ci_id
    ? { label: 'Belum hadir', icon: CircleDashed, cls: 'bg-danger-soft text-danger ring-danger/15' }
    : r.terlambat
      ? { label: 'Terlambat', icon: AlarmClock, cls: 'bg-warn-soft text-warn ring-warn/20' }
      : { label: 'Tepat waktu', icon: CircleCheck, cls: 'bg-success-soft text-success ring-success/20' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1', s.cls)}>
      <s.icon size={13} /> {s.label}
    </span>
  );
}

function Location({ r }: { r: AttendanceRow }) {
  if (!r.ci_id) return <span className="text-muted/60">—</span>;
  if (r.ci_mock || r.co_mock) return <span className="inline-flex items-center gap-1.5 font-medium text-danger"><ShieldAlert size={15} className="shrink-0" /> Lokasi palsu</span>;
  if (r.ci_inside === false) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-warn" title={`${km(r.ci_distance)} dari ${r.ci_desa}`}>
        <MapPinX size={15} className="shrink-0" /> <span className="truncate">Di luar desa · {km(r.ci_distance)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <MapPinCheck size={15} className="shrink-0 text-success" /> <span className="truncate">{r.ci_desa ?? 'Desa binaan'}</span>
      {r.co_inside === false && <span className="whitespace-nowrap rounded-full bg-warn-soft px-1.5 text-[10px] text-warn">pulang di luar</span>}
    </span>
  );
}

function Times({ r }: { r: AttendanceRow }) {
  const ci = jam(r.ci_time, r.timezone);
  const co = jam(r.co_time, r.timezone);
  if (!ci) return <span className="text-muted/60">—</span>;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="inline-flex items-center gap-1"><LogIn size={13} className="text-muted" />{ci}</span>
      <span className="text-muted/50">→</span>
      <span className={cn('inline-flex items-center gap-1', !co && 'text-muted/60')}><LogOut size={13} className="text-muted" />{co ?? '—'}</span>
      <span className="text-[11px] text-muted">{tzLabel(r.timezone)}</span>
      {r.ci_late_sync && <span title="Dikirim saat kembali online" className="text-muted"><CloudOff size={13} /></span>}
    </span>
  );
}

function Selfies({ r }: { r: AttendanceRow }) {
  const shots = [r.ci_selfie && r.ci_id && { id: r.ci_id, label: 'masuk' }, r.co_selfie && r.co_id && { id: r.co_id, label: 'pulang' }].filter(Boolean) as { id: string; label: string }[];
  if (!shots.length) return null;
  return (
    <span className="flex -space-x-2">
      {shots.map((s) => (
        <a key={s.id} href={`/api/proxy/attendances/${s.id}/selfie`} target="_blank" rel="noreferrer" title={`Swafoto ${s.label}`} className="relative z-10 transition hover:z-20 hover:scale-110">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/proxy/attendances/${s.id}/selfie?thumb=1`} alt={`Swafoto ${s.label}`} className="h-9 w-9 rounded-full object-cover ring-2 ring-surface" loading="lazy" />
        </a>
      ))}
    </span>
  );
}

/** Kehadiran harian per Bhabin: tabel di layar lebar, kartu di HP. */
export function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return (
    <>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.user_id} className={cn('px-4 py-3', !r.ci_id && 'bg-danger-soft/20')}>
            <div className="flex items-center gap-3">
              <Avatar nama={r.nama} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{personName(r)}</p>
                <p className="truncate text-xs text-muted">{r.unit}</p>
              </div>
              <Status r={r} />
            </div>
            {r.ci_id && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pl-12 text-xs">
                <Times r={r} />
                <Location r={r} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table minWidth={900}>
          <THead>
            <Th className="pl-5">Bhabinkamtibmas</Th>
            <Th>Status</Th>
            <Th>Masuk → Pulang</Th>
            <Th>Durasi</Th>
            <Th>Lokasi absen</Th>
            <Th align="right" className="pr-5">Swafoto</Th>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.user_id} className={cn(!r.ci_id && 'bg-danger-soft/15')}>
                <Td className="pl-5">
                  <span className="flex items-center gap-3">
                    <Avatar nama={r.nama} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{personName(r)}</span>
                      <span className="block truncate text-xs text-muted">{r.nrp} · {r.unit}</span>
                    </span>
                  </span>
                </Td>
                <Td><Status r={r} /></Td>
                <Td><Times r={r} /></Td>
                <Td className="tabular-nums text-muted">{durasi(r.durasi_menit) ?? <span className="text-muted/60">—</span>}</Td>
                <Td className="max-w-[16rem]"><Location r={r} /></Td>
                <Td align="right" className="pr-5"><span className="inline-flex justify-end"><Selfies r={r} /></span></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}
