import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api/server';

/** BFF: browser memanggil /api/proxy/*, token API tidak pernah terekspos ke JavaScript. */
async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const res = await apiFetch(`/${path.join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: { 'content-type': req.headers.get('content-type') ?? 'application/json' },
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
  });
  return new NextResponse(res.status === 204 ? null : await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
