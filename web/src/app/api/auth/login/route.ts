import { NextRequest, NextResponse } from 'next/server';
import { API_URL, saveSession } from '@/lib/api/server';

export async function POST(req: NextRequest) {
  const { nrp, password } = await req.json();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
    body: JSON.stringify({ nrp, password }),
  });
  const body = await res.json();
  if (!res.ok) return NextResponse.json(body, { status: res.status });

  await saveSession(body, body.user);
  return NextResponse.json({ user: body.user });
}
