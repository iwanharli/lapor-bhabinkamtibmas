import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { ACCOUNTS, login } from './helpers';

test('laporan bulanan: filter kategori, pembanding, wilayah ikut ke unduhan', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan-bulanan');
  await page.getByRole('button', { name: /^Filter/ }).click();
  await page.getByRole('combobox', { name: 'Kategori' }).click();
  await page.getByRole('option', { name: 'Deteksi Dini' }).click();
  await expect(page).toHaveURL(/kategori=DETEKSI_DINI/);
  await expect(page.getByText('Disaring: Deteksi Dini')).toBeVisible();
  await expect(page.getByText('Kehadiran', { exact: true })).toBeHidden();

  await page.getByRole('combobox', { name: 'Pembanding' }).click();
  await page.getByRole('option', { name: 'Banding tahun lalu' }).click();
  await expect(page).toHaveURL(/pembanding=tahun/);

  await page.getByRole('combobox', { name: 'Provinsi' }).click();
  await page.getByRole('option', { name: /Daerah Khusus/ }).click();
  await expect(page).toHaveURL(/provinsiKode=31/);
  await expect(page.getByText(/Disaring: Deteksi Dini · Daerah Khusus/)).toBeVisible();

  for (const [label, magic] of [['Unduh PDF', '%PDF'], ['Unduh Excel', 'PK']] as const) {
    await page.getByRole('button', { name: label }).click();
    const panel = page.getByRole('dialog', { name: 'Pengaturan unduhan' });
    await panel.getByRole('switch', { name: 'Harga pangan' }).click();
    const link = panel.getByRole('link', { name: label });
    await expect(link).toHaveAttribute('href', /kategori=DETEKSI_DINI.*wilayah=31.*pembanding=tahun/);
    await expect(link).not.toHaveAttribute('href', /bagian=[^&]*harga/);
    await panel.getByRole('switch', { name: 'Harga pangan' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(readFileSync((await dl.path())!).subarray(0, magic.length).toString()).toBe(magic);
  }
});
