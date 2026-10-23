/** Nama & opsi cookie sesi; dipakai bersama oleh middleware dan kode server (tanpa next/headers). */

export const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';

export const COOKIE = { access: 'lapor_at', refresh: 'lapor_rt', user: 'lapor_user' } as const;

export const SESSION_MAX_AGE = 12 * 3600;

/** Access token dianggap habis sedikit lebih awal agar tidak kedaluwarsa di tengah request. */
const ACCESS_SKEW_SECONDS = 30;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** Umur refresh token (detik) dari server. */
  refreshExpiresIn?: number;
  /** "Ingat saya": cookie bertahan sampai refresh token habis; tanpa itu cookie hilang saat browser ditutup. */
  remember?: boolean;
}

/** Umur cookie sesi: panjang bila "Ingat saya", selain itu cookie sesi browser (tanpa maxAge). */
const sessionAge = (t: Tokens) => (t.remember ? { maxAge: t.refreshExpiresIn ?? SESSION_MAX_AGE } : {});

const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

export function tokenCookies(t: Tokens) {
  return [
    { name: COOKIE.access, value: t.accessToken, ...base, maxAge: Math.max(t.expiresIn - ACCESS_SKEW_SECONDS, 60) },
    { name: COOKIE.refresh, value: t.refreshToken, ...base, ...sessionAge(t) },
  ];
}

export function userCookie(user: unknown, t: Tokens) {
  return { name: COOKIE.user, value: JSON.stringify(user), ...base, ...sessionAge(t) };
}

export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as Tokens) : null;
}
