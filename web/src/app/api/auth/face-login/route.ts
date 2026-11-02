import { NextRequest, NextResponse } from 'next/server';
import { API_URL, clientHeaders, saveSession } from '@/lib/api/server';

/** Langkah 2 login: teruskan token sementara + dua foto ke API, lalu simpan sesi. */
export async function POST(req: NextRequest) {
  const res = await fetch(`${API_URL}/auth/face/login`, { method: 'POST', headers: clientHeaders(req.headers), body: await req.formData() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  await saveSession(body, body.user);
  return NextResponse.json({ user: body.user });
}
