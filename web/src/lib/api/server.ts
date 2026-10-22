import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, COOKIE, Tokens, tokenCookies, userCookie } from './session-cookies';

export { API_URL };

export interface SessionUser {
  id: string;
  nrp: string;
  nama: string;
  role: string;
  unit: { id: string; nama: string; level: string; timezone?: string };
  mustChangePassword: boolean;
}

/** Hanya dari Route Handler / Server Action (Server Component tidak boleh menulis cookie). */
export async function saveSession(t: Tokens, user?: SessionUser) {
  const c = await cookies();
  for (const ck of tokenCookies(t)) c.set(ck);
  if (user) c.set(userCookie(user));
}

export async function clearSession() {
  const c = await cookies();
  Object.values(COOKIE).forEach((n) => c.delete(n));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE.user)?.value;
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

/**
 * Memanggil API dengan access token dari cookie. Perpanjangan token dilakukan oleh middleware
 * sebelum request sampai ke sini, sehingga di sini tidak ada rotasi token.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(COOKIE.access)?.value;
  return fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...(init.headers ?? {}), ...(token && { authorization: `Bearer ${token}` }) },
  });
}

/** Sesi tidak valid lagi (dicabut, kedaluwarsa, akun dinonaktifkan) → kembali ke login. */
function sessionExpired(): never {
  redirect('/login?expired=1');
}

function accessDenied(): never {
  redirect('/akses-ditolak');
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401) sessionExpired();
  if (res.status === 403) accessDenied();
  if (!res.ok) throw new Error(`API ${path} gagal: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Seperti apiGet, tetapi mengembalikan null bila data tidak ada / di luar cakupan (404) atau id tidak valid (400). */
export async function apiGetOrNotFound<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (res.status === 401) sessionExpired();
  if (res.status === 403) accessDenied();
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`API ${path} gagal: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Header asal klien (IP & user-agent browser) yang diteruskan BFF ke API agar tercatat di audit log. */
export function clientHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const ua = h.get('user-agent');
  const xff = h.get('x-forwarded-for') ?? h.get('x-real-ip');
  if (ua) out['user-agent'] = ua;
  if (xff) out['x-forwarded-for'] = xff;
  return out;
}
