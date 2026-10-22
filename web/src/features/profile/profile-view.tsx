import {
  Activity, BadgeCheck, Building2, CalendarCheck, CalendarDays, ChevronRight, FilePen, FileText, Flame, Globe2, IdCard, KeyRound,
  LogIn, MapPin, MapPinned, Monitor, ShieldAlert, Smartphone, UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { PersonalCard } from './personal-card';
import { cn } from '@/components/ui';
import { CATEGORY_LABEL, ROLE_LABEL, relatif, tanggal, tanggalJam, tzLabel } from '@/lib/format';

export interface Profile {
  id: string; nrp: string; nama: string; pangkat: string | null; jabatan: string | null; role: string; phone: string | null;
  active: boolean; mustChangePassword: boolean; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  unit: { id: string; kode: string; nama: string; level: string; timezone: string };
  unitChain: { id: string; nama: string; level: string }[];
  villages: { since: string; until: string | null; village: { id: string; nama: string; kodeWilayah: string; kecamatan: string; kabupaten: string; provinsi: string } }[];
  devices: { id: string; platform: string; model: string | null; appVersion: string | null; lastSeenAt: string | null }[];
  stats: { reportsSubmitted: number; drafts: number; priority: number; reports30d: number; attendance30d: number };
  activity: {
    id: string; action: string; entity: string | null; at: string; ip: string | null; userAgent: string | null; client: string | null;
    target: null | {
      kind: 'report' | 'attendance'; id: string; nomor?: string; category?: string; status?: string; type?: string; desa: string | null;
      gps: { lat: number; lng: number; accuracy: number | null; insideVillage: boolean | null; distanceM: number | null; mock: boolean };
    };
  }[];
}

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Masuk ke aplikasi', LOGOUT: 'Keluar dari aplikasi', LOGIN_FAILED: 'Percobaan masuk gagal', PASSWORD_CHANGED: 'Mengganti kata sandi',
  REPORT_CREATE: 'Membuat laporan', REPORT_UPDATE: 'Memperbarui laporan', REPORT_SUBMIT: 'Mengirim laporan', REPORT_DRAFT_DISCARD: 'Membuang draft', PROFILE_UPDATE: 'Memperbarui data pribadi',
  ATTENDANCE_RECORD: 'Absen', ATTACHMENT_UPLOAD: 'Mengunggah foto', ATTACHMENT_DOWNLOAD: 'Mengunduh lampiran', SENSITIVE_READ: 'Membuka data sensitif',
  EXPORT_CREATE: 'Membuat ekspor', EXPORT_DOWNLOAD: 'Mengunduh ekspor', USER_CREATE: 'Menambah akun', USER_UPDATE: 'Mengubah akun',
  USER_RESET_PASSWORD: 'Mereset sandi akun', USER_SET_VILLAGES: 'Menetapkan desa binaan', DEVICE_REVOKE: 'Mencabut perangkat',
};
const LEVEL_LABEL: Record<string, string> = { MABES: 'Mabes', POLDA: 'Polda', POLRES: 'Polres', POLSEK: 'Polsek' };

/** Peramban + versi utama, sistem operasi, dan jenis perangkat dari user-agent. */
function deviceOf(ua: string | null, client?: string | null) {
  if (!ua) return null;
  const m = (re: RegExp) => ua.match(re)?.[1];
  const app = /Dart|okhttp/i.test(ua) || client === 'mobile';
  const browser = app ? 'Aplikasi HP'
    : m(/Edg\/(\d+)/) ? `Edge ${m(/Edg\/(\d+)/)}` : m(/Firefox\/(\d+)/) ? `Firefox ${m(/Firefox\/(\d+)/)}`
    : m(/Chrome\/(\d+)/) ? `Chrome ${m(/Chrome\/(\d+)/)}` : m(/Version\/(\d+).*Safari/) ? `Safari ${m(/Version\/(\d+).*Safari/)}` : 'Peramban';
  const os = m(/Android (\d+)/) ? `Android ${m(/Android (\d+)/)}` : m(/OS (\d+)_\d+.*like Mac/) ? `iOS ${m(/OS (\d+)_\d+.*like Mac/)}`
    : /Mac OS X/.test(ua) ? 'macOS' : /Windows NT 10/.test(ua) ? 'Windows 10/11' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const type = /iPad|Tablet/.test(ua) ? 'tablet' : /Mobile|Android|iPhone/.test(ua) ? 'HP' : 'komputer';
  return { browser, os, type };
}

function Card({ title, icon: Icon, action, children, className }: { title: string; icon: typeof UserRound; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-sm', className)}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon size={16} className="text-[var(--brand)]" />
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const initials = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Gabungkan aktivitas beruntun yang sama (mis. 8× "Masuk") agar riwayat tidak berulang. */
function collapse(list: Profile['activity']) {
  const out: (Profile['activity'][number] & { n: number; last: string })[] = [];
  for (const a of list) {
    const prev = out.at(-1);
    if (prev && !a.target && !prev.target && prev.action === a.action && prev.userAgent === a.userAgent && prev.ip === a.ip) { prev.n++; prev.last = a.at; }
    else out.push({ ...a, n: 1, last: a.at });
  }
  return out;
}
const ipLabel = (ip: string | null) => (!ip ? null : ip.replace(/^::ffff:/, '') + (ip === '::1' || /^(::ffff:)?127\./.test(ip) ? ' (lokal)' : ''));
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);

/** Rincian satu aktivitas: objek (laporan/absensi), GPS, perangkat & IP. */
function ActivityDetail({ a, base }: { a: Profile['activity'][number]; base: string }) {
  const d = deviceOf(a.userAgent, a.client);
  const t = a.target;
  const g = t?.gps;
  return (
    <span className="mt-1 block space-y-1">
      {t && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {t.kind === 'report' ? (
            <Link href={`${base}/laporan/${t.id}`} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary hover:underline">
              <FileText size={11} /> {t.nomor}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">
              <CalendarCheck size={11} /> {t.type === 'CHECK_IN' ? 'Absen masuk' : 'Absen pulang'}
            </span>
          )}
          {t.category && <span className="text-muted">{CATEGORY_LABEL[t.category] ?? t.category}</span>}
          {t.desa && <span className="text-muted">· Desa {t.desa}</span>}
        </span>
      )}
      {g && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <a href={`https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=17/${g.lat}/${g.lng}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono hover:text-primary hover:underline"><MapPin size={11} /> {g.lat.toFixed(5)}, {g.lng.toFixed(5)}</a>
          {g.accuracy != null && <span>±{Math.round(g.accuracy)} m</span>}
          {g.mock ? <span className="rounded bg-danger-soft px-1 font-semibold text-danger">lokasi palsu</span>
            : g.insideVillage === false ? <span className="rounded bg-warn-soft px-1 font-semibold text-warn">di luar desa{g.distanceM != null ? ` · ${km(g.distanceM)}` : ''}</span>
            : g.insideVillage ? <span className="rounded bg-success-soft px-1 font-semibold text-success">di desa binaan</span> : null}
        </span>
      )}
      {(d || a.ip) && (
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          {d && <span className="inline-flex items-center gap-1">{d.type === 'komputer' ? <Monitor size={11} /> : <Smartphone size={11} />}{[d.browser, d.os].filter(Boolean).join(' · ')}</span>}
          {a.ip && <span className="inline-flex items-center gap-1 font-mono"><Globe2 size={11} /> {ipLabel(a.ip)}</span>}
        </span>
      )}
    </span>
  );
}

const ACTION_TONE = (a: string) => a === 'LOGIN_FAILED' ? 'bg-danger/10 text-danger' : a.startsWith('LOG') ? 'bg-primary/10 text-primary'
  : a.startsWith('REPORT') || a.startsWith('ATTACHMENT') ? 'bg-info/10 text-info' : a.startsWith('ATTENDANCE') ? 'bg-success/10 text-success' : 'bg-bg text-muted';

/** Aktivitas sebagai tabel padat di layar lebar: waktu, aktivitas & objek, lokasi GPS, perangkat, IP. */
function ActivityTable({ rows, tz, base }: { rows: ReturnType<typeof collapse>; tz: string; base: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="py-2 pl-4 pr-3 font-medium">Waktu</th>
            <th className="px-3 py-2 font-medium">Aktivitas</th>
            <th className="px-3 py-2 font-medium">Lokasi GPS</th>
            <th className="px-3 py-2 font-medium">Perangkat</th>
            <th className="py-2 pl-3 pr-4 font-medium">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((a) => {
            const t = a.target;
            const g = t?.gps;
            const d = deviceOf(a.userAgent, a.client);
            return (
              <tr key={a.id} className="align-top hover:bg-bg/50">
                <td className="whitespace-nowrap py-2.5 pl-4 pr-3">
                  <span className="block font-medium tabular-nums">{new Date(a.at).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="block text-[11px] text-muted" title={tanggalJam(a.at, tz)}>{relatif(a.at, tz)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', ACTION_TONE(a.action).split(' ')[0].replace('/10', ''))} />
                    <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, ' ')}</span>
                    {a.n > 1 && <span className="rounded-full bg-bg px-1.5 text-[11px] font-semibold text-muted ring-1 ring-line">{a.n}×</span>}
                  </span>
                  {t && (
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 pl-4 text-xs text-muted">
                      {t.kind === 'report'
                        ? <Link href={`${base}/laporan/${t.id}`} className="font-mono text-[11px] font-semibold text-primary hover:underline">{t.nomor}</Link>
                        : <span className="font-semibold text-success">{t.type === 'CHECK_IN' ? 'Absen masuk' : 'Absen pulang'}</span>}
                      {t.category && <span>{CATEGORY_LABEL[t.category] ?? t.category}</span>}
                      {t.desa && <span>· {t.desa}</span>}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {g ? (
                    <>
                      <a href={`https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lng}#map=17/${g.lat}/${g.lng}`} target="_blank" rel="noreferrer" className="block font-mono text-muted hover:text-primary hover:underline">
                        {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
                      </a>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {g.accuracy != null && <span className="text-muted">±{Math.round(g.accuracy)} m</span>}
                        {g.mock ? <span className="font-semibold text-danger">lokasi palsu</span>
                          : g.insideVillage === false ? <span className="font-semibold text-warn">luar desa{g.distanceM != null ? ` · ${km(g.distanceM)}` : ''}</span>
                          : g.insideVillage ? <span className="font-semibold text-success">di desa</span> : null}
                      </span>
                    </>
                  ) : <span className="text-muted/50">—</span>}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {d ? (
                    <span className="flex items-center gap-1.5">
                      {d.type === 'komputer' ? <Monitor size={14} className="shrink-0 text-muted" /> : <Smartphone size={14} className="shrink-0 text-muted" />}
                      <span><span className="block font-medium">{d.browser}</span><span className="block text-muted">{d.os || d.type}</span></span>
                    </span>
                  ) : <span className="text-muted/50">—</span>}
                </td>
                <td className="whitespace-nowrap py-2.5 pl-3 pr-4 font-mono text-xs text-muted">{ipLabel(a.ip) ?? <span className="text-muted/50">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Halaman profil pengguna (dipakai dashboard & tampilan Bhabin). `compact` = tata letak satu kolom untuk HP. */
export function ProfileView({ p, compact }: { p: Profile; compact?: boolean }) {
  const tz = p.unit.timezone;
  const bhabin = p.role === 'BHABIN';
  const activeVillage = p.villages.find((v) => !v.until);
  const pastVillages = p.villages.filter((v) => v.until);
  const stats = [
    { icon: FileText, label: 'Laporan terkirim', value: p.stats.reportsSubmitted, cls: 'bg-primary/10 text-primary' },
    { icon: CalendarDays, label: 'Laporan 30 hari', value: p.stats.reports30d, cls: 'bg-info/10 text-info' },
    { icon: Flame, label: 'Laporan prioritas', value: p.stats.priority, cls: 'bg-danger/10 text-danger' },
    bhabin
      ? { icon: CalendarCheck, label: 'Hari hadir (30 hari)', value: p.stats.attendance30d, cls: 'bg-success/10 text-success' }
      : { icon: FilePen, label: 'Draft', value: p.stats.drafts, cls: 'bg-warn/10 text-warn' },
  ];
  const showStats = bhabin || p.stats.reportsSubmitted > 0;
  const activity = collapse(p.activity);
  const unitNow = p.unitChain.at(-1);

  const identity = (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative h-24 bg-gradient-to-br from-[var(--brand-deep)] via-[var(--brand)] to-[var(--brand-2)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>
      <div className="relative z-10 -mt-12 flex flex-col items-center px-5 pb-5 text-center">
        <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] text-3xl font-bold text-white shadow-lg ring-4 ring-surface">{initials(p.nama)}</span>
        {p.pangkat && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand)]">{p.pangkat}</p>}
        <h1 className="text-xl font-bold leading-tight">{p.nama}</h1>
        <p className="mt-0.5 text-sm text-muted">{p.jabatan ?? ROLE_LABEL[p.role] ?? p.role}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary"><BadgeCheck size={12} /> {ROLE_LABEL[p.role] ?? p.role}</span>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', p.active ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', p.active ? 'bg-success' : 'bg-danger')} /> {p.active ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      </div>
      <dl className="divide-y divide-line/70 border-t border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-2.5"><dt className="flex items-center gap-2 text-muted"><IdCard size={15} /> NRP</dt><dd className="font-mono font-semibold">{p.nrp}</dd></div>
        <div className="flex items-center justify-between gap-3 px-5 py-2.5"><dt className="flex items-center gap-2 text-muted"><Building2 size={15} /> Satuan</dt><dd className="truncate font-medium">{unitNow?.nama ?? p.unit.nama}</dd></div>
        <div className="flex items-center justify-between gap-3 px-5 py-2.5"><dt className="flex items-center gap-2 text-muted"><LogIn size={15} /> Terakhir masuk</dt><dd className="font-medium">{p.lastLoginAt ? relatif(p.lastLoginAt, tz) : '—'}</dd></div>
        <div className="flex items-center justify-between gap-3 px-5 py-2.5"><dt className="flex items-center gap-2 text-muted"><CalendarDays size={15} /> Bergabung</dt><dd className="font-medium">{tanggal(p.createdAt, tz)}</dd></div>
      </dl>
      <div className="border-t border-line p-4">
        <Link href="/ganti-sandi" className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg py-2.5 text-sm font-semibold transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"><KeyRound size={15} /> Ganti kata sandi</Link>
      </div>
    </section>
  );

  return (
    <div className={cn('grid gap-5', !compact && 'lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start')}>
      <div className={cn('space-y-4', !compact && 'lg:sticky lg:top-20')}>
        {identity}
        {p.mustChangePassword && (
          <Link href="/ganti-sandi" className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft/60 p-3.5 text-sm">
            <ShieldAlert size={20} className="shrink-0 text-warn" />
            <span className="flex-1">Masih memakai kata sandi awal. <strong>Ganti sekarang.</strong></span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        {showStats && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((st) => (
              <div key={st.label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', st.cls)}><st.icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-tight tabular-nums">{st.value.toLocaleString('id-ID')}</span>
                  <span className="block truncate text-xs text-muted">{st.label}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={cn('grid gap-4', !compact && 'xl:grid-cols-2')}>
          <PersonalCard data={p} className="h-full" />
          <div className="space-y-4">
          <Card title="Satuan kerja" icon={Building2}>
            <ol className="px-4 py-3">
              {p.unitChain.map((u, i) => {
                const last = i === p.unitChain.length - 1;
                return (
                  <li key={u.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {!last && <span className="absolute left-[11px] top-6 h-full w-px bg-line" />}
                    <span className={cn('relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold', last ? 'bg-[var(--brand)] text-white ring-4 ring-[var(--brand)]/15' : 'bg-bg text-muted ring-1 ring-line')}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">{LEVEL_LABEL[u.level] ?? u.level}</span>
                      <span className={cn('block truncate text-sm', last && 'font-semibold')}>{u.nama}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <dl className="grid grid-cols-2 divide-x divide-line/70 border-t border-line text-sm">
              <div className="px-4 py-2.5"><dt className="text-xs text-muted">Kode satuan</dt><dd className="truncate font-mono text-xs font-semibold">{p.unit.kode}</dd></div>
              <div className="px-4 py-2.5"><dt className="text-xs text-muted">Zona waktu</dt><dd className="font-semibold">{tzLabel(tz)} <span className="text-xs font-normal text-muted">{tz}</span></dd></div>
            </dl>
          </Card>
          <Card title="Perangkat aplikasi" icon={Smartphone}>
            {p.devices.length ? (
              <ul className="divide-y divide-line/70">
                {p.devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-muted"><Smartphone size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.model ?? d.platform}</span>
                      <span className="block text-xs text-muted">{d.platform}{d.appVersion ? ` · v${d.appVersion}` : ''}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{d.lastSeenAt ? relatif(d.lastSeenAt, tz) : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-4 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-muted"><Monitor size={17} /></span>
                <p className="text-sm text-muted">Hanya lewat web. Belum ada aplikasi HP yang terdaftar.</p>
              </div>
            )}
          </Card>
          </div>
        </div>
          {bhabin && (
            <Card title="Desa binaan" icon={MapPinned}>
              {activeVillage ? (
                <div className="p-4">
                  <div className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3.5">
                    <p className="flex items-center gap-2 text-base font-semibold"><MapPinned size={17} className="text-[var(--brand)]" /> Desa {activeVillage.village.nama}</p>
                    <p className="mt-1 text-sm text-muted">Kec. {activeVillage.village.kecamatan}, {activeVillage.village.kabupaten}, {activeVillage.village.provinsi}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>Kode wilayah <span className="font-mono text-ink">{activeVillage.village.kodeWilayah}</span></span>
                      <span>Sejak <span className="text-ink">{tanggal(activeVillage.since, tz)}</span></span>
                    </p>
                  </div>
                </div>
              ) : <p className="px-4 py-6 text-center text-sm text-muted">Belum ada desa binaan. Hubungi admin satuan.</p>}
              {pastVillages.length > 0 && (
                <div className="border-t border-line px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Riwayat</p>
                  <ul className="space-y-1.5 text-sm">
                    {pastVillages.map((v) => (
                      <li key={`${v.village.id}-${v.since}`} className="flex justify-between gap-3">
                        <span className="truncate">{v.village.nama} <span className="text-muted">· {v.village.kecamatan}</span></span>
                        <span className="shrink-0 text-xs text-muted">{tanggal(v.since, tz)} – {tanggal(v.until!, tz)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
          <Card title="Aktivitas terakhir" icon={Activity}>
            {activity.length && !compact ? (
              <>
                <div className="hidden md:block"><ActivityTable rows={activity} tz={tz} base={bhabin ? '/bhabin' : ''} /></div>
                <ol className="px-4 py-3 md:hidden">
                {activity.map((a, i) => (
                  <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < activity.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                    <span className={cn('relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-surface', a.action === 'LOGIN_FAILED' ? 'bg-danger' : i === 0 ? 'bg-[var(--brand)]' : 'bg-line')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, ' ')}
                          {a.n > 1 && <span className="ml-1.5 rounded-full bg-bg px-1.5 text-[11px] font-semibold text-muted ring-1 ring-line">{a.n}×</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted" title={tanggalJam(a.at, tz)}>{relatif(a.at, tz)}</span>
                      </span>
                      <ActivityDetail a={a} base={bhabin ? '/bhabin' : ''} />
                    </span>
                  </li>
                ))}
              </ol>
              </>
            ) : activity.length ? (
              <ol className="px-4 py-3">
                {activity.map((a, i) => (
                  <li key={a.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < activity.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                    <span className={cn('relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-surface', a.action === 'LOGIN_FAILED' ? 'bg-danger' : i === 0 ? 'bg-[var(--brand)]' : 'bg-line')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, ' ')}
                          {a.n > 1 && <span className="ml-1.5 rounded-full bg-bg px-1.5 text-[11px] font-semibold text-muted ring-1 ring-line">{a.n}×</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted" title={tanggalJam(a.at, tz)}>{relatif(a.at, tz)}</span>
                      </span>
                      <ActivityDetail a={a} base={bhabin ? '/bhabin' : ''} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className="px-4 py-6 text-center text-sm text-muted">Belum ada aktivitas tercatat.</p>}
          </Card>
      </div>
    </div>
  );
}
