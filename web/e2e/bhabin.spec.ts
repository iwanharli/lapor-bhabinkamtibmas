import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

// Tampilan lapangan Bhabin di web/HP: ukuran HP, GPS di dalam desa binaan Situ Udik.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: -6.61824, longitude: 106.65272, accuracy: 10 },
  permissions: ['geolocation'],
});

// PNG 1×1 sebagai foto.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('Bhabin membuat, mengirim, dan meralat laporan dari web', async ({ page }) => {
  await login(page, ACCOUNTS.bhabin);
  await expect(page).toHaveURL(/\/bhabin$/);
  await expect(page.getByRole('heading', { name: /Made Wibowo/ })).toBeVisible();

  await page.getByRole('link', { name: 'Sambang' }).first().click();
  await expect(page.getByText('Lokasi didapat')).toBeVisible();
  await expect(page.getByText('Situ Udik').first()).toBeVisible(); // desa binaan terkunci
  await page.locator('label:has-text("Jenis sasaran") select').selectOption('Warga');
  const nama = `Warga E2E ${Date.now()}`;
  await page.locator('label:has-text("Nama warga/tokoh") input').fill(nama);
  await page.locator('label:has-text("Alamat") input').fill('RT 01 / RW 01');
  await page.getByRole('button', { name: 'Narkoba' }).click();
  await page.locator('label:has-text("Tanggapan") textarea').fill('Tanggapan uji E2E web Bhabin');
  await page.locator('input[capture="environment"]').first().setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });

  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  await expect(page.getByText('Laporan terkirim')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(nama)).toBeVisible();

  await page.getByRole('link', { name: 'Ralat', exact: true }).click();
  await page.locator('label:has-text("Tanggapan") textarea').fill('Tanggapan setelah ralat E2E');
  await page.getByRole('button', { name: 'Simpan ralat' }).click();
  await expect(page.getByText('Ralat tersimpan')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Tanggapan setelah ralat E2E')).toBeVisible();
});

test('Bhabin tidak bisa membuka dashboard, peran lain tidak bisa membuka tampilan lapangan', async ({ page }) => {
  await login(page, ACCOUNTS.bhabin);
  await page.goto('/kinerja');
  await expect(page).toHaveURL(/\/bhabin$/);
  await page.context().clearCookies();
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/bhabin/laporan');
  await expect(page).not.toHaveURL(/\/bhabin/);
});
