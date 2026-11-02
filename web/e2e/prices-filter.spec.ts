import { expect, test } from '@playwright/test';
import { ACCOUNTS, API, apiLogin, login } from './helpers';

test('harga pangan: filter wilayah, daftar pasar, lalu komoditas di pasar', async ({ page }) => {
  const token = await apiLogin(ACCOUNTS.pimpinan);
  const get = async (path: string) => (await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })).json();
  const count = (rows: { sampel: number }[]) => rows.reduce((n, r) => n + r.sampel, 0);
  const all = await get('/analytics/prices/latest') as { sampel: number }[];
  const one = await get('/analytics/prices/latest?wilayah=31.74.01') as { sampel: number }[];
  expect(count(one)).toBeLessThanOrEqual(count(all));
  expect((await fetch(`${API}/analytics/prices/latest?wilayah=x'--`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(400);

  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/harga-pangan?provinsiKode=31&kabupatenKode=31.74');
  await expect(page.getByText(`${count(await get('/analytics/prices/latest?wilayah=31.74') as { sampel: number }[]).toLocaleString('id-ID')} sampel harga, 7 hari`)).toBeVisible();

  await page.getByRole('link', { name: 'Detail' }).first().click();
  await expect(page).toHaveURL(/harga-pangan\/wilayah\/31\.74\.\d\d/);
  await expect(page.getByText('Daftar pasar')).toBeVisible();

  await page.getByRole('link', { name: 'Detail' }).first().click();
  await expect(page).toHaveURL(/harga-pangan\/pasar\?desa=/);
  await expect(page.getByText('Detail komoditas')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByText('Toko / kios per komoditas')).toBeVisible();
  await expect(page.getByText('Riwayat pencatatan Bhabin')).toBeVisible();
  await page.getByRole('link', { name: /^HP-/ }).first().click();
  await expect(page).toHaveURL(/\/laporan\/[0-9a-f-]{36}/);
});
