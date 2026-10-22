'use client';

import { FlaskConical, ShieldCheck } from 'lucide-react';
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
    const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
    if (!res.ok) {
      setBusy(undefined);
      const body = await res.json().catch(() => ({}));
      return onError(body?.error?.message ?? 'Login percobaan gagal');
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-warn/50 bg-warn-soft/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warn">
        <FlaskConical size={14} /> Akun percobaan · hanya lokal
      </p>
      <div className="grid grid-cols-2 gap-2">
        {accounts.map((a) => (
          <button key={a.key} type="button" disabled={!!busy} onClick={() => loginAs(a.key)} title={`NRP ${a.nrp}`}
            className={cn('rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary-soft/40 disabled:opacity-60', busy === a.key && 'border-primary')}>
            <span className="block text-sm font-semibold leading-tight">{busy === a.key ? 'Masuk…' : a.label}</span>
            <span className="block truncate text-[11px] text-muted">{a.hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">Bhabinkamtibmas masuk lewat aplikasi mobile.</p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const expired = useSearchParams().get('expired') === '1';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nrp: form.get('nrp'), password: form.get('password') }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? 'Login gagal');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(80%_60%_at_50%_0%,rgb(59_130_246/0.40),transparent_70%),linear-gradient(180deg,var(--navy),var(--navy-2))] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8 shadow-xl">
        <div className="mb-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-lg shadow-primary/30">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-xl font-bold">Lapor Bhabinkamtibmas</h1>
          <p className="text-sm text-muted">Masuk ke dashboard pelaporan</p>
        </div>
        {expired && <Alert tone="warn">Sesi Anda berakhir. Silakan masuk kembali.</Alert>}
        <Field label="NRP">{(id) => <Input id={id} name="nrp" inputMode="numeric" required autoComplete="username" />}</Field>
        <Field label="Sandi">{(id) => <Input id={id} name="password" type="password" required autoComplete="current-password" />}</Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Masuk</Button>
        <DevLogin onError={setError} />
      </form>
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
