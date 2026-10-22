import { expect, test } from '@playwright/test';
import { ACCOUNTS, createSubmittedReport, login } from './helpers';

test('laporan dari Bhabin bisa diverifikasi di web', async ({ page }) => {
  const report = await createSubmittedReport('verifikasi');
  await login(page, ACCOUNTS.verifikator);
  await page.goto('/laporan?status=MENUNGGU');
  await page.getByPlaceholder(/Cari nomor laporan/).fill(report.nomor);
  await page.locator('tbody').getByText(report.nomor).click();

  await expect(page.getByRole('heading', { name: report.nomor })).toBeVisible();
  await expect(page.getByText('Ditinjau').first()).toBeVisible();
  await expect(page.locator('img[src*="thumb=1"]')).toHaveCount(1);

  // Minta revisi wajib catatan.
  await page.getByRole('button', { name: 'Minta revisi' }).click();
  await page.getByRole('button', { name: 'Kirim permintaan revisi' }).click();
  await expect(page.getByText(/minimal 5 karakter/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click();

  await page.getByRole('button', { name: 'Setujui', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Setujui' }).click();
  await expect(page.getByText('Disetujui').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minta revisi' })).toHaveCount(0);
});

test('tab status, pagination, dan ukuran halaman', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan?rentang=semua');
  const summary = page.locator('nav[aria-label=Halaman] p');
  await expect(summary).toContainText('Menampilkan 1–20');

  await page.locator('nav[aria-label=Halaman]').getByRole('link', { name: '2', exact: true }).click();
  await expect(summary).toContainText('Menampilkan 21–40');

  await page.locator('nav[aria-label=Halaman]').getByRole('link', { name: '50', exact: true }).click();
  await expect(summary).toContainText('Menampilkan 1–50');

  await page.getByRole('link', { name: /Disetujui/ }).first().click();
  await expect(page).toHaveURL(/status=APPROVED/);
  await expect(page.locator('tbody').getByText('Disetujui').first()).toBeVisible();
});

test('ekspor CSV mengikuti filter', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan?category=HARGA_PANGAN&rentang=semua');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Ekspor CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^laporan_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await (await download.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const lines = csv.trim().split('\n');
  expect(lines[0]).toContain('Nomor;Kategori;Status');
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(1).every((l) => l.includes('Harga Pangan'))).toBeTruthy();
});
