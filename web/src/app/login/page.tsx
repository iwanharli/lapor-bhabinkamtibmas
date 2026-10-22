'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert, Button, ErrorText, Field, Input } from '@/components/ui';

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
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(80%_60%_at_50%_0%,rgb(201_162_39/0.30),transparent_70%),linear-gradient(180deg,var(--navy),var(--navy-2))] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-8 shadow-xl">
        <div className="mb-2">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#a8801a] text-navy shadow-lg shadow-accent/20">
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
