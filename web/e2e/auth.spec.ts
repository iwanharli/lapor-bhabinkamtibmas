import { expect, test } from '@playwright/test';
import { ACCOUNTS, createUser, deactivateUser, login } from './helpers';

test('login salah menampilkan pesan', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name=nrp]').fill(ACCOUNTS.admin);
  await page.locator('input[name=password]').fill('salah-sekali');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByText('NRP atau sandi salah')).toBeVisible();
});

test('halaman terlindungi mengarah ke login', async ({ page }) => {
  await page.goto('/laporan');
  await expect(page).toHaveURL(/\/login/);
});

test('pengguna baru wajib mengganti sandi sementara', async ({ page }) => {
  const u = await createUser();
  try {
    await login(page, u.nrp, u.password);
    await expect(page).toHaveURL(/\/ganti-sandi/);
    // Halaman lain tetap diarahkan kembali selama sandi belum diganti.
    await page.goto('/laporan');
    await expect(page).toHaveURL(/\/ganti-sandi/);

    await page.getByLabel('Sandi sementara').fill(u.password);
    await page.getByLabel('Sandi baru', { exact: true }).fill('SandiE2E2026');
    await page.getByLabel('Ulangi sandi baru').fill('SandiE2E2026');
    await page.getByRole('button', { name: 'Simpan sandi baru' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Ringkasan' })).toBeVisible();
  } finally {
    await deactivateUser(u.id, u.adminToken);
  }
});

test('admin melihat menu administrasi, pimpinan tidak', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await expect(page.getByRole('link', { name: 'Pengguna' })).toBeVisible();
  await page.getByRole('button', { name: /Siti Rahmawati/ }).click();
  await page.getByRole('button', { name: 'Keluar' }).click();
  await login(page, ACCOUNTS.pimpinanPolsek);
  await expect(page.getByRole('link', { name: 'Pengguna' })).toHaveCount(0);
});
