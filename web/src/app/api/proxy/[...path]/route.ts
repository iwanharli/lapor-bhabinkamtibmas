import { NextRequest, NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api/server';

/** Header respons API yang diteruskan ke browser (untuk file, gambar, dan unduhan CSV). */
const PASS_HEADERS = ['content-type', 'content-disposition', 'cache-control', 'content-length', 'x-content-type-options'];

/** BFF: browser memanggil /api/proxy/*, token API tidak pernah terekspos ke JavaScript. Body diteruskan apa adanya (termasuk biner). */
async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const contentType = req.headers.get('content-type');
  const res = await apiFetch(`/${path.join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: contentType ? { 'content-type': contentType } : {},
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
  });
  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(res.status === 204 ? null : res.body, { status: res.status, headers });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
