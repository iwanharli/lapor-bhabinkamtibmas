import { NextRequest, NextResponse } from 'next/server';
import { API_URL, saveSession, clientHeaders } from '@/lib/api/server';
import { devAccounts, devLoginEnabled } from '@/lib/dev-accounts';

const notFound = () => NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

/** Daftar akun percobaan (tanpa sandi) — 404 di luar lingkungan lokal. */
export async function GET() {
  if (!devLoginEnabled()) return notFound();
  return NextResponse.json(devAccounts().map(({ key, nrp, label, hint, nama, role, group }) => ({ key, nrp, label, hint, nama, role, group })));
}

/** Login sebagai akun percobaan; sandi diambil di server, tidak pernah dikirim ke browser. */
export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return notFound();
  const { key } = await req.json();
  const acc = devAccounts().find((a) => a.key === key);
  if (!acc) return notFound();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...clientHeaders(req.headers) },
    body: JSON.stringify({ nrp: acc.nrp, password: acc.password }),
  });
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  await saveSession(body, body.user);
  return NextResponse.json({ user: body.user });
}
