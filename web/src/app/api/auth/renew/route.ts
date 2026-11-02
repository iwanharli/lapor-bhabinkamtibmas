import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { saveSession } from '@/lib/api/server';
import { COOKIE, refreshTokens } from '@/lib/api/session-cookies';

/** Setelah satu langkah orientasi selesai: token baru agar status orientasi di token ikut berubah. */
export async function POST() {
  const rt = (await cookies()).get(COOKIE.refresh)?.value;
  const tokens = rt ? await refreshTokens(rt) : null;
  if (!tokens) return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  await saveSession(tokens);
  return NextResponse.json({ ok: true });
}
