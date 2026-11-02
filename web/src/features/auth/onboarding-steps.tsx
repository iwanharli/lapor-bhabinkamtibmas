'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorText, Field, Input } from '@/components/ui';
import { LiveFaceCapture } from './live-face-capture';

const PHONE = /^(\+?62|0)8\d{7,12}$/;

/** Token baru tanpa batasan orientasi; halaman /orientasi lalu menentukan langkah berikutnya. */
async function next(router: ReturnType<typeof useRouter>) {
  await fetch('/api/auth/renew', { method: 'POST' });
  router.refresh();
}

export interface ProfileValue { nama: string; pangkat: string; jabatan: string; phone: string }

export function ProfileStep({ initial }: { initial: ProfileValue }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof ProfileValue) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (Object.values(v).some((x) => !x.trim())) return setError('Seluruh data wajib diisi.');
    if (!PHONE.test(v.phone.trim())) return setError('Nomor HP tidak valid (mis. 0812xxxxxxxx).');
    setBusy(true);
    setError('');
    const res = await fetch('/api/proxy/auth/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });
    if (!res.ok) {
      setBusy(false);
      return setError((await res.json().catch(() => ({})))?.error?.message ?? 'Gagal menyimpan profil.');
    }
    await next(router);
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Nama lengkap" required>{(id) => <Input id={id} value={v.nama} onChange={set('nama')} />}</Field>
      <Field label="Pangkat" required>{(id) => <Input id={id} value={v.pangkat} onChange={set('pangkat')} placeholder="mis. Bripka" />}</Field>
      <Field label="Jabatan" required>{(id) => <Input id={id} value={v.jabatan} onChange={set('jabatan')} />}</Field>
      <Field label="No. HP / WhatsApp" required>{(id) => <Input id={id} inputMode="tel" value={v.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" />}</Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" loading={busy} loadingText="Menyimpan…">Simpan & lanjut</Button>
    </form>
  );
}

const facePhotos = (frontal: Blob, turned: Blob) => {
  const form = new FormData();
  form.set('frontal', frontal, 'depan.jpg');
  form.set('turned', turned, 'menoleh.jpg');
  return form;
};

const failure = async (res: Response) => new Error((await res.json().catch(() => ({})))?.error?.message ?? 'Verifikasi wajah gagal. Coba lagi.');

export function FaceEnrollStep() {
  const router = useRouter();
  return (
    <LiveFaceCapture onCaptured={async (frontal, turned) => {
      const res = await fetch('/api/proxy/auth/face/enroll', { method: 'POST', body: facePhotos(frontal, turned) });
      if (!res.ok) throw await failure(res);
      await next(router);
    }} />
  );
}

/** Langkah 2 login: `onDone` setelah sesi tersimpan, `onExpired` bila token sementara habis. */
export function FaceLoginStep({ faceToken, onDone, onExpired }: { faceToken: string; onDone: () => void; onExpired: (message: string) => void }) {
  return (
    <LiveFaceCapture onCaptured={async (frontal, turned) => {
      const form = facePhotos(frontal, turned);
      form.set('faceToken', faceToken);
      const res = await fetch('/api/auth/face-login', { method: 'POST', body: form });
      if (res.ok) return onDone();
      const error = await failure(res);
      if (res.status === 401 && !/tidak cocok/i.test(error.message)) return onExpired(error.message);
      throw error;
    }} />
  );
}

export function LogoutLink() {
  const router = useRouter();
  return (
    <button type="button" className="text-sm text-muted hover:text-ink" onClick={async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
    }}>Keluar</button>
  );
}
