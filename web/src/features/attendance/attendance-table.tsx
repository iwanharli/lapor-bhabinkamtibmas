import { CircleAlert, MapPinCheck, MapPinX, ShieldAlert } from 'lucide-react';
import { Badge, CellStack, Table, Td, Th, THead, Tr } from '@/components/ui';
import { tzLabel } from '@/lib/format';
import type { AttendanceRow } from './types';

const jam = (iso: string | null, tz: string) =>
  iso ? `${new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' })} ${tzLabel(tz)}` : null;
const km = (m: number | null) => (m == null ? '' : m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);

function Selfie({ id, label }: { id: string | null; label: string }) {
  if (!id) return null;
  return (
    <a href={`/api/proxy/attendances/${id}/selfie`} target="_blank" rel="noreferrer" title={`Swafoto ${label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/proxy/attendances/${id}/selfie?thumb=1`} alt={`Swafoto ${label}`} className="h-9 w-9 rounded-lg object-cover ring-1 ring-line" loading="lazy" />
    </a>
  );
}

function Location({ r }: { r: AttendanceRow }) {
  if (!r.ci_id) return <span className="text-muted">—</span>;
  if (r.ci_mock || r.co_mock) return <span className="inline-flex items-center gap-1.5 font-medium text-danger"><ShieldAlert size={15} /> Lokasi palsu terdeteksi</span>;
  if (r.ci_inside === false) {
    return <span className="inline-flex items-center gap-1.5 text-warn"><MapPinX size={15} /> Di luar desa binaan · {km(r.ci_distance)} dari {r.ci_desa}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <MapPinCheck size={15} className="text-success" /> {r.ci_desa ?? 'Desa binaan'}
      {r.co_inside === false && <Badge tone="warn">pulang di luar desa</Badge>}
    </span>
  );
}

/** Tabel kehadiran harian per Bhabin. */
export function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return (
    <Table minWidth={860}>
      <THead>
        <Th className="pl-5">Bhabinkamtibmas</Th>
        <Th>Masuk</Th>
        <Th>Pulang</Th>
        <Th>Lokasi absen</Th>
        <Th align="right" className="pr-5">Swafoto</Th>
      </THead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.user_id}>
            <Td className="pl-5">
              <CellStack primary={[r.pangkat, r.nama].filter(Boolean).join(' ')} secondary={`${r.nrp} · ${r.unit}`} />
            </Td>
            <Td>
              {r.ci_time ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="tabular-nums">{jam(r.ci_time, r.timezone)}</span>
                  {r.terlambat ? <Badge tone="warn">terlambat</Badge> : <Badge tone="success">tepat waktu</Badge>}
                  {r.ci_late_sync && <span title="Dikirim saat kembali online" className="text-muted"><CircleAlert size={14} /></span>}
                </span>
              ) : (
                <Badge tone="danger">belum hadir</Badge>
              )}
            </Td>
            <Td className="tabular-nums">{jam(r.co_time, r.timezone) ?? <span className="text-muted">—</span>}</Td>
            <Td><Location r={r} /></Td>
            <Td align="right" className="pr-5">
              <div className="flex justify-end gap-1.5">
                <Selfie id={r.ci_selfie && r.ci_id} label="masuk" />
                <Selfie id={r.co_selfie && r.co_id} label="pulang" />
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
