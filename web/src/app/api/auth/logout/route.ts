import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_URL, clearSession } from '@/lib/api/server';
import { COOKIE } from '@/lib/api/session-cookies';

export async function POST() {
  const rt = (await cookies()).get(COOKIE.refresh)?.value;
  if (rt) {
    // Cukup refresh token, agar logout tetap berhasil walau access token sudah habis.
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
