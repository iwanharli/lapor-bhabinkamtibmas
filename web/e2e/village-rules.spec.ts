import { expect, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import { ACCOUNTS, API, apiLogin, login, PASSWORD } from './helpers';

const SELONG = '887c5697-6832-432d-a351-d49546334fda';
const MENTENG_DALAM = '0c066cc4-ec2b-49fd-a8bb-25ab9987f877';
const IN_SELONG = { lat: -6.23477, lng: 106.80428 };
const IN_MENTENG_DALAM = { lat: -6.231567, lng: 106.841216 };
const MONAS = { lat: -6.1754, lng: 106.8272 };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const call = (path: string, token: string, method = 'GET', body?: unknown) =>
  fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });

async function draft(token: string, villageId: string, location: { lat: number; lng: number }) {
  const res = await call('/reports', token, 'POST', {
    clientUuid: randomUUID(), category: 'SAMBANG', schemaVersion: 1, villageId, occurredAt: new Date(Date.now() - 600_000).toISOString(), location, gpsAccuracyM: 8,
    data: { jenis_sasaran: 'Tokoh Masyarakat', nama_sasaran: 'Warga aturan desa', alamat: 'RT 01 / RW 01', pesan_kamtibmas: ['Narkoba'], tanggapan: 'Uji aturan desa' },
  });
  expect(res.ok, await res.clone().text()).toBeTruthy();
  const { id } = await res.json() as { id: string };
  const form = new FormData();
  form.set('file', new Blob([PNG], { type: 'image/png' }), 'foto.png');
  form.set('fieldKey', 'foto_bersama');
  expect((await fetch(`${API}/reports/${id}/attachments`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form })).ok).toBeTruthy();
  return id;
}

test('Bhabin membina beberapa desa dan hanya bisa mengirim dari dalam desa terpilih', async ({ page }) => {
  const admin = await apiLogin(ACCOUNTS.admin);
  const bhabin = await apiLogin(ACCOUNTS.bhabin, { mobile: true });
  const { id: userId } = await (await call('/auth/me', bhabin)).json() as { id: string };
  try {
    expect((await call(`/admin/users/${userId}/villages`, admin, 'PUT', { villageIds: [SELONG, MENTENG_DALAM] })).ok).toBeTruthy();
    const me = await (await call('/auth/me', bhabin)).json() as { villages: unknown[] };
    expect(me.villages).toHaveLength(2);

    // Di luar desa: ditolak, tetap draft.
    const outside = await draft(bhabin, SELONG, MONAS);
    const rejected = await call(`/reports/${outside}/submit`, bhabin, 'POST');
    expect(rejected.status).toBe(400);
    expect((await rejected.json() as { error: { code: string } }).error.code).toBe('OUTSIDE_VILLAGE');
    expect((await call(`/reports/${outside}`, bhabin, 'DELETE')).ok).toBeTruthy();

    // Titik benar untuk desa kedua, tapi desa pertama yang dipilih: ditolak.
    const wrong = await draft(bhabin, SELONG, IN_MENTENG_DALAM);
    expect((await call(`/reports/${wrong}/submit`, bhabin, 'POST')).status).toBe(400);
    expect((await call(`/reports/${wrong}`, bhabin, 'DELETE')).ok).toBeTruthy();

    // Di dalam desa kedua: terkirim.
    const inside = await draft(bhabin, MENTENG_DALAM, IN_MENTENG_DALAM);
    expect((await call(`/reports/${inside}/submit`, bhabin, 'POST')).ok).toBeTruthy();

    // Ralat tidak boleh memindahkan laporan ke desa yang titiknya di luar.
    const moved = await call(`/reports/${inside}`, bhabin, 'PATCH', { villageId: SELONG });
    expect(moved.status).toBe(400);

    // Formulir web menawarkan pilihan desa.
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: IN_SELONG.lat, longitude: IN_SELONG.lng, accuracy: 10 });
    await login(page, ACCOUNTS.bhabin, PASSWORD);
    await page.goto('/bhabin/lapor/SAMBANG');
    const picker = page.getByLabel('Desa binaan');
    await expect(picker.locator('option')).toHaveCount(2);
    await picker.selectOption(MENTENG_DALAM);
    await expect(page.getByText(/Titik GPS laporan berada/)).toBeVisible({ timeout: 10_000 });
    await picker.selectOption(SELONG);
    await expect(page.getByText(/Titik GPS laporan berada/)).toBeHidden({ timeout: 10_000 });
  } finally {
    await call(`/admin/users/${userId}/villages`, admin, 'PUT', { villageIds: [SELONG] });
  }
});
