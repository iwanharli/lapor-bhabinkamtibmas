import { expect, test } from '@playwright/test';
import { ACCOUNTS, API, createSubmittedReport, login } from './helpers';

test('laporan terkirim langsung final dan dapat diralat pelapor', async ({ page }) => {
  const report = await createSubmittedReport('final');
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan?rentang=semua');
  await page.getByPlaceholder(/Cari nomor laporan/).fill(report.nomor);
  await page.locator('tbody').getByText(report.nomor).click();

  await expect(page.getByRole('heading', { name: report.nomor })).toBeVisible();
  await expect(page.getByText('Terkirim').first()).toBeVisible();
  await expect(page.getByText(/masih dapat meralat/)).toBeVisible();
  await expect(page.locator('img[src*="thumb=1"]')).toHaveCount(1);
  // Tidak ada lagi aksi verifikasi.
  await expect(page.getByRole('button', { name: /Setujui|Minta revisi|Tolak/ })).toHaveCount(0);

  // Pelapor meralat isian laporan terkirim (seperti aplikasi mobile).
  const res = await fetch(`${API}/reports/${report.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${report.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data: { jenis_sasaran: 'Tokoh Agama', nama_sasaran: 'Warga ralat', alamat: 'RT 02 / RW 01', pesan_kamtibmas: ['Narkoba'], tanggapan: 'Tanggapan setelah ralat' } }),
  });
  expect(res.ok, await res.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByText('Tanggapan setelah ralat')).toBeVisible();
});

test('pagination dan ukuran halaman', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan?rentang=semua');
  const summary = page.locator('nav[aria-label=Halaman] p');
  await expect(summary).toContainText('Menampilkan 1–20');

  await page.locator('nav[aria-label=Halaman]').getByRole('link', { name: '2', exact: true }).click();
  await expect(summary).toContainText('Menampilkan 21–40');

  await page.locator('nav[aria-label=Halaman]').getByRole('link', { name: '50', exact: true }).click();
  await expect(summary).toContainText('Menampilkan 1–50');
});

test('ekspor CSV mengikuti filter', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan?category=HARGA_PANGAN&rentang=semua');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Ekspor CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^laporan_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await (await download.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
  const lines = csv.trim().split('\n');
  expect(lines[0]).toContain('Nomor;Kategori;Prioritas');
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.slice(1).every((l) => l.includes('Harga Pangan'))).toBeTruthy();
});
