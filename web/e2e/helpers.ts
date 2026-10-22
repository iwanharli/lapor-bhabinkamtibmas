import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'crypto';

export const API = process.env.API_URL ?? 'http://localhost:3000/api/v1';
export const PASSWORD = 'Demo#12345';

/** Akun dari seed dev (backend/prisma/seed.ts & seed-demo-reports.ts). */
export const ACCOUNTS = {
  bhabin: '90000001',
  verifikator: '90000002',
  pimpinan: '90000003',
  admin: '90000004',
};

export async function login(page: Page, nrp: string, password = PASSWORD) {
  await page.goto('/login');
  await page.locator('input[name=nrp]').fill(nrp);
  await page.locator('input[name=password]').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function api<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.token && { authorization: `Bearer ${init.token}` }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiLogin(nrp: string, opts: { mobile?: boolean; password?: string } = {}) {
  const body = { nrp, password: opts.password ?? PASSWORD, ...(opts.mobile && { device: { deviceId: 'e2e-device-0001', platform: 'android' } }) };
  return (await api<{ accessToken: string }>('/auth/login', { method: 'POST', body })).accessToken;
}

/** Buat & kirim laporan Sambang sebagai Bhabin lewat API (seperti aplikasi mobile). */
export async function createSubmittedReport(note = 'E2E') {
  const token = await apiLogin(ACCOUNTS.bhabin, { mobile: true });
  const me = await api<{ villages: { village: { id: string } }[] }>('/auth/me', { token });
  const villageId = me.villages[0].village.id;
  const report = await api<{ id: string; nomor: string }>('/reports', {
    method: 'POST',
    token,
    body: {
      clientUuid: randomUUID(),
      category: 'SAMBANG',
      schemaVersion: 1,
      villageId,
      occurredAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      location: { lat: -6.5951, lng: 106.8162 },
      gpsAccuracyM: 8,
      data: {
        jenis_sasaran: 'Tokoh Masyarakat',
        nama_sasaran: `Warga ${note}`,
        alamat: 'RT 01 / RW 01',
        pesan_kamtibmas: ['Narkoba'],
        tanggapan: `Tanggapan uji ${note}`,
      },
    },
  });
  // Foto bersama wajib: unggah gambar PNG 1×1.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'foto.png');
  form.set('fieldKey', 'foto_bersama');
  const up = await fetch(`${API}/reports/${report.id}/attachments`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  expect(up.ok, await up.text()).toBeTruthy();
  await api(`/reports/${report.id}/submit`, { method: 'POST', token });
  return report;
}

/** Buat pengguna baru lewat API admin; mengembalikan NRP & sandi sementara. */
export async function createUser(role = 'VERIFIKATOR') {
  const token = await apiLogin(ACCOUNTS.admin);
  const units = await api<{ id: string; kode: string }[]>('/units', { token });
  const unit = units.find((u) => u.kode === 'POLSEK-CONTOH')!;
  const nrp = `97${String(Date.now()).slice(-8)}`;
  const res = await api<{ temporaryPassword: string; user: { id: string } }>('/admin/users', {
    method: 'POST',
    token,
    body: { nrp, nama: `Pengguna E2E ${nrp.slice(-4)}`, role, unitId: unit.id },
  });
  return { nrp, password: res.temporaryPassword, id: res.user.id, adminToken: token };
}

export async function deactivateUser(id: string, adminToken: string) {
  await api(`/admin/users/${id}`, { method: 'PATCH', token: adminToken, body: { active: false } });
}
