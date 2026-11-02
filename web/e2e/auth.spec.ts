import { expect, test } from '@playwright/test';
import { ACCOUNTS, createUser, deactivateUser, login } from './helpers';

test('login salah menampilkan pesan', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name=nrp]').fill(ACCOUNTS.admin);
  await page.locator('input[name=password]').fill('salah-sekali');
  await page.locator('form button[type=submit]').click();
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
    // Pengguna baru lanjut ke orientasi, dan halaman lain tetap diarahkan ke sana.
    await page.waitForURL(/\/orientasi/);
    await expect(page.getByRole('heading', { name: 'Lengkapi profil' })).toBeVisible();
    await page.goto('/laporan');
    await expect(page).toHaveURL(/\/orientasi/);

    await page.getByLabel(/Pangkat/).fill('Bripka');
    await page.getByLabel(/Jabatan/).fill('Staf');
    await page.getByLabel(/No\. HP/).fill('081234567890');
    await page.getByRole('button', { name: 'Simpan & lanjut' }).click();
    await expect(page.getByRole('heading', { name: 'Daftarkan wajah' })).toBeVisible();
  } finally {
    await deactivateUser(u.id, u.adminToken);
  }
});

test('admin melihat menu administrasi, pimpinan tidak', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await expect(page.getByRole('link', { name: 'Pengguna' })).toBeVisible();
  await page.getByRole('button', { name: /Siti Rahmawati/ }).click();
  await page.getByRole('button', { name: 'Keluar' }).click();
  await page.waitForURL(/\/login/); // tunggu keluar selesai agar navigasi login berikutnya tidak bertabrakan
  await login(page, ACCOUNTS.pimpinanPolsek);
  await expect(page.getByRole('link', { name: 'Pengguna' })).toHaveCount(0);
});
