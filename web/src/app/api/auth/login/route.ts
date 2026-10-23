import { NextRequest, NextResponse } from 'next/server';
import { API_URL, clientHeaders, saveSession } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  const { nrp, password, remember } = await req.json();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...clientHeaders(req.headers) },
    body: JSON.stringify({ nrp, password, remember: remember === true }),
  });
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });

  await saveSession(body, body.user);
  return NextResponse.json({ user: body.user });
}
