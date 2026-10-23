'use client';

import { ArrowRight, Eye, EyeOff, FlaskConical, LockKeyhole, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Alert, Button, Checkbox, cn, ErrorText, Field, Input, Modal, ModalBody } from '@/components/ui';
import { Logo } from '@/components/brand/logo';
import { ROLE_INFO, type DemoRole, type DevAccount } from '@/lib/dev-accounts';

const ROLE_TONE: Record<DemoRole, string> = {
  SUPERADMIN: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  PIMPINAN: 'bg-primary/10 text-primary',
  ADMIN_UNIT: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
  AUDITOR: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
  BHABIN: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
};

/** Tombol kecil "Akun demo" → modal semua akun demo per wilayah; sekali klik untuk masuk. Hanya bila server mengizinkan. */
function DemoLogin({ onError }: { onError: (m: string) => void }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DevAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string>();
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    fetch('/api/auth/dev-login').then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => undefined);
  }, []);
  if (!accounts.length) return null;

  const groups = [...new Set(accounts.map((a) => a.group))];
  const active = group ?? groups[0];

  async function loginAs(key: string) {
    setBusy(key);
    onError('');
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError(body?.error?.message ?? 'Login akun demo gagal');
        setBusy(undefined);
        setOpen(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setBusy(undefined);
      setOpen(false);
      onError('Tidak dapat terhubung ke server. Coba lagi.');
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 rounded-full border border-dashed border-warn/50 bg-warn-soft/40 px-3 py-1.5 text-xs font-semibold text-warn transition hover:bg-warn-soft">
        <FlaskConical size={13} /> Akun demo · masuk 1 klik
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} dismissible={!busy} size="lg" title="Akun demo"
        description="Pilih wilayah lalu klik akun untuk langsung masuk. Data demo: Polda Metro Jaya (6 kabupaten/kota DKI Jakarta).">
        <ModalBody className="space-y-4">
          <div className="grid gap-1.5 rounded-xl bg-surface-2 p-3 text-xs sm:grid-cols-2">
            {(Object.keys(ROLE_INFO) as DemoRole[]).map((r) => (
              <p key={r} className="leading-5">
                <span className={cn('mr-1.5 rounded px-1.5 py-0.5 font-semibold', ROLE_TONE[r])}>{ROLE_INFO[r].label}</span>
                <span className="text-muted">{ROLE_INFO[r].desc}</span>
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {groups.map((g) => (
              <button key={g} type="button" role="tab" aria-selected={g === active} onClick={() => setGroup(g)}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', g === active ? 'border-primary bg-primary text-white' : 'border-line text-muted hover:border-primary/40 hover:text-ink')}>
                {g}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {accounts.filter((a) => a.group === active).map((a) => (
              <button key={a.key} type="button" disabled={!!busy} onClick={() => loginAs(a.key)}
                className={cn('group flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-primary/50 hover:bg-primary-soft/40 disabled:opacity-60', busy === a.key && 'border-primary bg-primary-soft/40')}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', ROLE_TONE[a.role])}>{a.label}</span>
                    <span className="font-mono text-[11px] text-muted">{a.nrp}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold">{a.nama}</span>
                  <span className="block truncate text-xs text-muted">{a.hint}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  {busy === a.key ? 'Masuk…' : <ArrowRight size={16} />}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Semua akun memakai sandi <span className="font-mono font-semibold text-ink">BrsDemo2026</span>. Bhabinkamtibmas juga tersedia di aplikasi Android.</p>
        </ModalBody>
      </Modal>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const expired = useSearchParams().get('expired') === '1';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nrp: form.get('nrp'), password: form.get('password'), remember: form.get('remember') === 'on' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? 'Nomor NRP atau sandi belum benar.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[linear-gradient(145deg,var(--navy),var(--navy-2))] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-36 top-1/4 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 top-[30%] h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 top-[36%] h-[19rem] w-[19rem] rounded-full bg-primary-2/10" />
        <div className="relative flex items-center gap-3">
          <Logo size={56} />
          <span>
            <strong className="block text-sm font-bold tracking-wide">BINMAS</strong>
            <span className="text-xs text-white/65">Baharkam Polri</span>
          </span>
        </div>
        <div className="relative max-w-xl pb-8">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f1c83b]" /> Sistem pelaporan dan pemantauan
          </span>
          <h2 className="max-w-lg text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl">Dekat dengan warga, sigap dalam pelayanan.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/65">Satu ruang kerja untuk memantau laporan kegiatan dan menindaklanjuti kebutuhan masyarakat.</p>
          <div className="mt-9 flex flex-wrap gap-2">
            {['Pelaporan', 'Pemantauan', 'Tindak lanjut'].map((item) => (
              <span key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/75">{item}</span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">Lapor Bhabinkamtibmas · Baharkam Polri</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-[27rem]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo size={48} />
            <span><strong className="block text-sm font-bold tracking-wide">BINMAS</strong><span className="text-xs text-muted">Lapor Bhabinkamtibmas</span></span>
          </div>

          <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_70px_-36px_rgba(16,43,88,.38)] sm:p-9">
            <div className="mb-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Portal petugas</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.75rem]">Selamat datang</h1>
              <p className="mt-1.5 text-sm leading-6 text-muted">Masuk menggunakan NRP dan sandi akun dinas Anda.</p>
            </div>
            {expired && <Alert tone="warn">Sesi Anda berakhir. Silakan masuk kembali.</Alert>}

            <Field label="Nomor Registrasi Pokok (NRP)">
              {(id) => <span className="relative block"><UserRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><Input id={id} name="nrp" inputMode="numeric" required autoComplete="username" placeholder="Masukkan NRP" className="h-12 rounded-xl pl-11" /></span>}
            </Field>
            <Field label="Sandi">
              {(id) => <span className="relative block"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><Input id={id} name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Masukkan sandi" className="h-12 rounded-xl pl-11 pr-12" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-ink">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>}
            </Field>

            <Checkbox name="remember" label={<span>Ingat saya <span className="text-muted">· tetap masuk 30 hari di perangkat ini</span></span>} />

            <ErrorText>{error}</ErrorText>
            <Button type="submit" size="lg" className="h-12 w-full rounded-xl shadow-md shadow-primary/20" loading={loading} loadingText="Memeriksa akun…" icon={!loading ? <ArrowRight size={17} /> : undefined}>Masuk ke dashboard</Button>
            <DemoLogin onError={setError} />
          </form>
          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted"><LockKeyhole size={13} /> Akses untuk petugas yang berwenang</p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
