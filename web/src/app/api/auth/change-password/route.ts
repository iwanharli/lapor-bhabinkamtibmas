import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, getSessionUser, saveSession } from '@/lib/api/server';

/** Ganti sandi: teruskan ke API lalu simpan token baru & tandai sesi tidak lagi memakai sandi sementara. */
export async function POST(req: NextRequest) {
  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(body, { status: res.status });

  const user = await getSessionUser();
  await saveSession(body, user ? { ...user, mustChangePassword: false } : undefined);
  return NextResponse.json({ ok: true });
}
