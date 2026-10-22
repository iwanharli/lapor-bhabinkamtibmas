'use client';

import { Check, KeyRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, Button, cn, ErrorText, Field, Input } from '@/components/ui';

const RULES = [
  { label: 'Minimal 10 karakter', test: (s: string) => s.length >= 10 },
  { label: 'Mengandung huruf', test: (s: string) => /[A-Za-z]/.test(s) },
  { label: 'Mengandung angka', test: (s: string) => /\d/.test(s) },
];

/** Form ganti sandi. `forced`: pengguna masih memakai sandi sementara dan belum boleh membuka halaman lain. */
export function ChangePasswordForm({ nama, forced }: { nama: string; forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rulesOk = RULES.every((r) => r.test(next));
  const match = next.length > 0 && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rulesOk) return setError('Sandi baru belum memenuhi syarat.');
    if (!match) return setError('Konfirmasi sandi tidak sama.');
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = body?.error;
      return setError(Array.isArray(err?.details) ? err.details.join('; ') : err?.message ?? 'Gagal mengganti sandi');
    }
    router.replace('/');
    router.refresh();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-8 shadow-xl">
      <div>
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary-2 to-primary text-white shadow-lg shadow-primary/30">
          <KeyRound size={24} />
        </div>
        <h1 className="text-xl font-bold">{forced ? 'Buat sandi baru' : 'Ganti sandi'}</h1>
        <p className="text-sm text-muted">{nama}</p>
      </div>
      {forced && (
        <Alert tone="warn">Anda masih memakai sandi sementara. Demi keamanan, buat sandi baru sebelum melanjutkan.</Alert>
      )}
      <Field label={forced ? 'Sandi sementara' : 'Sandi saat ini'}>
        {(id) => <Input id={id} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field label="Sandi baru">
        {(id) => <Input id={id} type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <ul className="grid gap-1 text-xs">
        {RULES.map((r) => {
          const ok = r.test(next);
          return (
            <li key={r.label} className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'text-muted')}>
              {ok ? <Check size={13} /> : <X size={13} />} {r.label}
            </li>
          );
        })}
      </ul>
      <Field label="Ulangi sandi baru" error={confirm && !match ? 'Belum sama dengan sandi baru' : undefined}>
        {(id) => <Input id={id} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!rulesOk || !match}>Simpan sandi baru</Button>
      <div className="flex justify-between text-sm">
        {forced ? (
          <button type="button" onClick={logout} className="text-muted hover:text-ink">Keluar</button>
        ) : (
          <button type="button" onClick={() => router.back()} className="text-muted hover:text-ink">Batal</button>
        )}
        <span className="text-xs text-muted">Semua perangkat lain akan dikeluarkan.</span>
      </div>
    </form>
  );
}
