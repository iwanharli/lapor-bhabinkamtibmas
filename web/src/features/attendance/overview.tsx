import { AlarmClock, LogOut, MapPinX, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { cn, RingProgress } from '@/components/ui';
import type { AttendanceDaily } from './types';

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** Grafik batang jam masuk 05–12 (di luar rentang digabung ke ujung); batang ≥ jam terlambat berwarna kuning. */
function HourChart({ hours, lateHour }: { hours: AttendanceDaily['hours']; lateHour: number }) {
  const bins = Array.from({ length: 8 }, (_, i) => ({ jam: 5 + i, jumlah: 0 }));
  for (const h of hours) bins[Math.min(Math.max(h.jam, 5), 12) - 5].jumlah += h.jumlah;
  const max = Math.max(...bins.map((b) => b.jumlah), 1);
  return (
    <div>
      <div className="flex h-28 items-end gap-1.5">
        {bins.map((b) => (
          <div key={b.jam} className="group relative flex h-full flex-1 flex-col justify-end" title={`${String(b.jam).padStart(2, '0')}.00–${String(b.jam).padStart(2, '0')}.59 · ${b.jumlah} Bhabin`}>
            <span className="mb-1 text-center text-[10px] font-semibold tabular-nums text-muted opacity-0 transition group-hover:opacity-100">{b.jumlah}</span>
            <span className={cn('w-full rounded-t-md transition-all', b.jam >= lateHour ? 'bg-warn/80' : 'bg-primary/80')} style={{ height: `${Math.max((b.jumlah / max) * 100, b.jumlah ? 4 : 1.5)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] tabular-nums text-muted">
        {bins.map((b) => <span key={b.jam} className={cn('flex-1 text-center', b.jam === lateHour && 'font-semibold text-warn')}>{b.jam === 5 ? '≤05' : b.jam === 12 ? '≥12' : String(b.jam).padStart(2, '0')}</span>)}
      </div>
    </div>
  );
}

/** Ringkasan kehadiran satu hari: cincin hadir, komposisi, sebaran jam masuk, dan kartu kecil. */
export function AttendanceOverview({ res, href }: { res: AttendanceDaily; href: (status?: string) => string }) {
  const s = res.summary;
  const belum = s.bhabin - s.hadir;
  const tepat = s.hadir - s.terlambat;
  const lateHour = Number(res.lateAfter.split(':')[0]);
  const parts = [
    { label: 'Tepat waktu', value: tepat, cls: 'bg-success' },
    { label: 'Terlambat', value: s.terlambat, cls: 'bg-warn' },
    { label: 'Belum hadir', value: belum, cls: 'bg-danger/70' },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <RingProgress value={pct(s.hadir, s.bhabin)} label="hadir" size={120} className="mx-auto" />
          <div className="space-y-2.5">
            <p className="text-sm text-muted"><strong className="text-2xl font-bold tabular-nums text-ink">{s.hadir.toLocaleString('id-ID')}</strong> / {s.bhabin.toLocaleString('id-ID')} Bhabin hadir</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
              {parts.map((p) => <span key={p.label} className={p.cls} style={{ width: `${pct(p.value, s.bhabin)}%` }} />)}
            </div>
            <ul className="space-y-1 text-sm">
              {parts.map((p) => (
                <li key={p.label}>
                  <Link href={href(p.label === 'Tepat waktu' ? 'hadir' : p.label === 'Terlambat' ? 'terlambat' : 'belum')} className="flex items-center gap-2 rounded-md hover:text-primary">
                    <span className={cn('h-2.5 w-2.5 rounded-full', p.cls)} />
                    <span className="flex-1 text-muted">{p.label}</span>
                    <strong className="tabular-nums">{p.value.toLocaleString('id-ID')}</strong>
                    <span className="w-10 text-right text-xs tabular-nums text-muted">{pct(p.value, s.bhabin)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sebaran jam masuk</p>
            <HourChart hours={res.hours} lateHour={lateHour} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href={href('belum')} className={cn('flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:-translate-y-0.5', belum ? 'border-danger/25 bg-danger-soft/40' : 'border-line bg-surface')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger"><UserX size={19} /></span>
          <span className="min-w-0"><span className="block text-xl font-bold tabular-nums">{belum.toLocaleString('id-ID')}</span><span className="block truncate text-xs text-muted">Belum hadir</span></span>
        </Link>
        <Link href={href('terlambat')} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm transition hover:-translate-y-0.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn"><AlarmClock size={19} /></span>
          <span className="min-w-0"><span className="block text-xl font-bold tabular-nums">{s.terlambat.toLocaleString('id-ID')}</span><span className="block truncate text-xs text-muted" title={`Absen masuk setelah ${res.lateAfter.replace(':', '.')} setempat`}>Terlambat</span></span>
        </Link>
        <Link href={href('luar')} className={cn('flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:-translate-y-0.5', s.luar + s.palsu ? 'border-warn/30 bg-warn-soft/40' : 'border-line bg-surface')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn"><MapPinX size={19} /></span>
          <span className="min-w-0"><span className="block text-xl font-bold tabular-nums">{(s.luar + s.palsu).toLocaleString('id-ID')}</span><span className="block truncate text-xs text-muted">Lokasi perlu dicek</span></span>
        </Link>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LogOut size={19} /></span>
          <span className="min-w-0"><span className="block text-xl font-bold tabular-nums">{s.pulang.toLocaleString('id-ID')}</span><span className="block truncate text-xs text-muted">Sudah absen pulang</span></span>
        </div>
      </div>
    </div>
  );
}

/** Unit (Polsek) dengan kehadiran terendah hari itu; klik untuk menyaring tabel ke unit tersebut. */
export function LowestUnits({ units, href }: { units: AttendanceDaily['lowestUnits']; href: (unitId: string) => string }) {
  if (!units.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-danger/10 text-danger"><UserCheck size={16} /></span>
        <div><h2 className="text-sm font-semibold">Kehadiran terendah</h2><p className="text-xs text-muted">Unit dengan persentase hadir paling kecil · klik untuk melihat yang belum hadir</p></div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {units.map((u) => {
          const p = pct(u.hadir, u.bhabin);
          return (
            <li key={u.unit_id}>
              <Link href={href(u.unit_id)} className="block rounded-xl border border-line p-3 transition hover:border-primary/40 hover:bg-bg">
                <span className="block truncate text-sm font-medium" title={u.unit}>{u.unit}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className={cn('block h-full rounded-full', p < 50 ? 'bg-danger' : p < 80 ? 'bg-warn' : 'bg-success')} style={{ width: `${p}%` }} /></span>
                  <span className="text-xs font-semibold tabular-nums">{p}%</span>
                </span>
                <span className="mt-1 block text-[11px] text-muted">{u.hadir}/{u.bhabin} Bhabin hadir</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
