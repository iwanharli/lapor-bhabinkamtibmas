import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { ACCOUNTS, login } from './helpers';

test('laporan bulanan: filter kategori, pembanding, wilayah ikut ke unduhan', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan-bulanan');
  await page.getByLabel('Kategori', { exact: true }).selectOption('DETEKSI_DINI');
  await expect(page).toHaveURL(/kategori=DETEKSI_DINI/);
  await expect(page.getByText('Disaring: Deteksi Dini')).toBeVisible();
  await expect(page.getByText('Kehadiran', { exact: true })).toBeHidden();

  await page.getByLabel('Pembanding').selectOption('tahun');
  await expect(page).toHaveURL(/pembanding=tahun/);

  await page.getByLabel('Provinsi').selectOption('31');
  await expect(page).toHaveURL(/provinsiKode=31/);
  await expect(page.getByText(/Disaring: Deteksi Dini · Daerah Khusus/)).toBeVisible();

  for (const [label, magic] of [['Unduh PDF', '%PDF'], ['Unduh Excel', 'PK']] as const) {
    const link = page.getByRole('link', { name: label });
    await expect(link).toHaveAttribute('href', /kategori=DETEKSI_DINI.*wilayah=31.*pembanding=tahun/);
    const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(readFileSync((await dl.path())!).subarray(0, magic.length).toString()).toBe(magic);
  }
});
