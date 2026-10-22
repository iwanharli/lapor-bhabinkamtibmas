import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, refreshTokens, tokenCookies } from '@/lib/api/session-cookies';

const isApi = (req: NextRequest) => req.nextUrl.pathname.startsWith('/api/');

function sessionUser(req: NextRequest): { role?: string; mustChangePassword?: boolean } {
  try {
    return JSON.parse(req.cookies.get(COOKIE.user)?.value ?? '{}');
  } catch {
    return {};
  }
}

/** Bhabin memakai tampilan lapangan (/bhabin); peran lain memakai dashboard. */
function roleRedirect(req: NextRequest, role?: string) {
  const path = req.nextUrl.pathname;
  if (isApi(req) || path.startsWith('/ganti-sandi') || path.startsWith('/akses-ditolak')) return null;
  const inField = path === '/bhabin' || path.startsWith('/bhabin/');
  if (role === 'BHABIN' && !inField) return NextResponse.redirect(new URL('/bhabin', req.url));
  if (role && role !== 'BHABIN' && inField) return NextResponse.redirect(new URL('/', req.url));
  return null;
}

function toLogin(req: NextRequest, expired: boolean) {
  if (isApi(req)) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sesi berakhir, silakan masuk kembali' } }, { status: 401 });
  }
  const res = NextResponse.redirect(new URL(expired ? '/login?expired=1' : '/login', req.url));
  Object.values(COOKIE).forEach((n) => res.cookies.delete(n));
  return res;
}

/**
 * Menjaga sesi: bila access token sudah habis, perpanjang di sini (middleware boleh menulis cookie),
 * lalu teruskan token baru ke halaman/route handler pada request yang sama.
 */
export async function middleware(req: NextRequest) {
  const rt = req.cookies.get(COOKIE.refresh)?.value;
  if (!rt || !req.cookies.has(COOKIE.user)) return toLogin(req, false);

  // Sandi sementara: hanya halaman ganti sandi yang boleh dibuka (API juga menolak di sisi backend).
  const user = sessionUser(req);
  if (user.mustChangePassword && !req.nextUrl.pathname.startsWith('/ganti-sandi') && !isApi(req)) {
    return NextResponse.redirect(new URL('/ganti-sandi', req.url));
  }
  const redirect = roleRedirect(req, user.role);
  if (redirect) return redirect;
  if (req.cookies.has(COOKIE.access)) return NextResponse.next();

  const tokens = await refreshTokens(rt);
  if (!tokens) return toLogin(req, true);

  const cookies = tokenCookies(tokens);
  for (const c of cookies) req.cookies.set(c.name, c.value);
  const res = NextResponse.next({ request: { headers: req.headers } });
  for (const c of cookies) res.cookies.set(c);
  return res;
}

export const config = {
  matcher: ['/((?!login|api/auth|_next|favicon.ico|icon.png|apple-icon.png|logo.png).*)'],
};
