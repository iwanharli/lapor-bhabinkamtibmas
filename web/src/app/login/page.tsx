'use client';

import { ArrowRight, Eye, EyeOff, FlaskConical, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Alert, Button, cn, ErrorText, Field, Input } from '@/components/ui';
import type { DevAccount } from '@/lib/dev-accounts';

/** Tombol login cepat akun percobaan; hanya tampil bila server mengizinkan (lokal). */
function DevLogin({ onError }: { onError: (m: string) => void }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<DevAccount[]>([]);
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    fetch('/api/auth/dev-login').then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => undefined);
  }, []);
  if (!accounts.length) return null;

  async function loginAs(key: string) {
    setBusy(key);
    onError('');
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError(body?.error?.message ?? 'Login percobaan gagal');
        setBusy(undefined);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setBusy(undefined);
      onError('Tidak dapat terhubung ke server. Coba lagi.');
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-warn/45 bg-warn-soft/35 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-warn">
        <FlaskConical size={15} /> Akun percobaan · lokal
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => (
          <button key={a.key} type="button" disabled={!!busy} onClick={() => loginAs(a.key)} title={`NRP ${a.nrp}`}
            className={cn('rounded-lg border border-line/80 bg-surface px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary-soft/40 disabled:opacity-60', busy === a.key && 'border-primary')}>
            <span className="block text-sm font-semibold leading-tight">{busy === a.key ? 'Masuk…' : a.label}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{a.hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">Bhabinkamtibmas juga dapat masuk di sini (web/HP) untuk membuat laporan dan absensi.</p>
    </div>
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
        body: JSON.stringify({ nrp: form.get('nrp'), password: form.get('password') }),
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
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/10">
            <ShieldCheck size={26} />
          </span>
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
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-md shadow-primary/20"><ShieldCheck size={23} /></span>
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

            <ErrorText>{error}</ErrorText>
            <Button type="submit" size="lg" className="h-12 w-full rounded-xl shadow-md shadow-primary/20" loading={loading} loadingText="Memeriksa akun…" icon={!loading ? <ArrowRight size={17} /> : undefined}>Masuk ke dashboard</Button>
            <DevLogin onError={setError} />
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
