'use client';

import { Camera, CheckCircle2, Crosshair, Loader2, LogIn, LogOut, MapPin, RotateCcw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, cn } from '@/components/ui';
import { newUuid, shrinkImage, uploadForm, useGeolocation } from './field-utils';

export interface MyAttendance {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  workDate: string;
  clientTime: string;
  insideVillage: boolean | null;
  distanceM: number | null;
  isMockLocation: boolean;
  lateSync: boolean;
  hasSelfie: boolean;
  villageName: string | null;
}

const jam = (iso: string, tz: string) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
const jarak = (m: number | null) => (m == null ? '' : m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);

const tzShort = (tz: string) => ({ 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' })[tz] ?? 'WIB';

/** Jam berjalan (diperbarui tiap 30 detik). */
function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <>{now ? jam(now.toISOString(), tz) : '--.--'}</>;
}


/** Absen masuk/pulang hari ini: GPS otomatis + swafoto kamera depan. */
export function AttendancePanel({ today, tz, lateAfter }: { today: MyAttendance[]; tz: string; lateAfter: string }) {
  const router = useRouter();
  const checkIn = today.find((a) => a.type === 'CHECK_IN');
  const checkOut = today.find((a) => a.type === 'CHECK_OUT');
  const next: 'CHECK_IN' | 'CHECK_OUT' | null = !checkIn ? 'CHECK_IN' : !checkOut ? 'CHECK_OUT' : null;
  const [open, setOpen] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const geo = useGeolocation();
  const preview = useMemo(() => (selfie ? URL.createObjectURL(selfie) : ''), [selfie]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function start() {
    setOpen(true);
    setSelfie(null);
    setError('');
    void geo.locate();
  }

  async function submit() {
    if (!next || !geo.fix || !selfie) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('clientUuid', newUuid());
      form.set('type', next);
      form.set('clientTime', new Date().toISOString());
      form.set('lat', String(geo.fix.lat));
      form.set('lng', String(geo.fix.lng));
      form.set('gpsAccuracyM', String(geo.fix.accuracy));
      form.set('selfie', await shrinkImage(selfie));
      await uploadForm('/attendances', form);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = next === 'CHECK_IN' ? 'Absen masuk' : 'Absen pulang';

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative bg-gradient-to-br from-[var(--navy-2)] via-primary to-primary-2 p-4 text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/75">Waktu sekarang ({tzShort(tz)})</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight"><Clock tz={tz} /></p>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1', !checkIn ? 'bg-white/10 ring-white/25' : !checkOut ? 'bg-emerald-400/20 ring-emerald-300/40' : 'bg-white/20 ring-white/30')}>
            {!checkIn ? 'Belum absen' : !checkOut ? 'Sedang bertugas' : 'Selesai'}
          </span>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          {[{ t: 'Masuk', a: checkIn, icon: LogIn }, { t: 'Pulang', a: checkOut, icon: LogOut }].map(({ t, a, icon: Icon }) => (
            <div key={t} className="rounded-xl bg-white/12 p-2.5 ring-1 ring-white/15">
              <p className="flex items-center gap-1.5 text-[11px] text-white/75"><Icon size={13} /> {t}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{a ? jam(a.clientTime, tz) : '—'}</p>
              {a && <p className="truncate text-[11px] text-white/85">{a.isMockLocation ? 'Lokasi palsu' : a.insideVillage === false ? `Di luar desa · ${jarak(a.distanceM)}` : a.villageName ?? 'Desa binaan'}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="p-4">
      {!next ? (
        <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> Absensi hari ini lengkap. Terima kasih.</p>
      ) : !open ? (
        <Button onClick={start} className="h-12 w-full text-base" icon={next === 'CHECK_IN' ? <LogIn size={19} /> : <LogOut size={19} />}>{label}</Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-primary/25 bg-primary-soft/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{label}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Batal" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg"><X size={16} /></button>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-surface p-2.5">
            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', geo.fix ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary')}>
              {geo.busy ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}
            </span>
            <p className="min-w-0 flex-1 text-xs">
              {geo.busy ? 'Mencari lokasi GPS…' : geo.fix ? <>Lokasi didapat · akurasi ±{geo.fix.accuracy} m</> : <span className="text-danger">{geo.error || 'Lokasi belum didapat'}</span>}
            </p>
            {!geo.busy && <button type="button" onClick={() => void geo.locate()} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Crosshair size={13} /> Ulangi</button>}
          </div>

          {selfie ? (
            <div className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Swafoto" className="aspect-[4/3] w-full object-cover" />
              <label className="absolute bottom-2 right-2 inline-flex cursor-pointer items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
                <RotateCcw size={13} /> Ulangi foto
                <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => e.target.files?.[0] && setSelfie(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-surface text-primary">
              <Camera size={30} />
              <span className="text-sm font-semibold">Ambil swafoto</span>
              <span className="text-xs text-muted">Kamera depan, wajah terlihat jelas</span>
              <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => e.target.files?.[0] && setSelfie(e.target.files[0])} />
            </label>
          )}

          {error && <Alert tone="danger">{error}</Alert>}
          <Button onClick={() => void submit()} disabled={!geo.fix || !selfie || busy} loading={busy} loadingText="Mengirim…" className="h-12 w-full">Kirim {label.toLowerCase()}</Button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted">Masuk setelah pukul {lateAfter.replace(':', '.')} waktu setempat tercatat terlambat. Lokasi diperiksa terhadap desa binaan (±200 m).</p>
      </div>
    </section>
  );
}
