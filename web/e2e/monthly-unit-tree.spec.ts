import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('laporan bulanan: per satuan bertingkat dan bisa disaring', async ({ page }) => {
  await login(page, '00000001');
  await page.goto('/laporan-bulanan?bulan=2026-10');
  await page.getByRole('button', { name: 'Buka Polda Metro Jaya' }).click();
  await page.getByRole('button', { name: 'Buka Polres Metro Jakarta Selatan' }).click();
  const tebet = page.getByRole('row', { name: /Polsek Tebet/ });
  await expect(tebet).toBeVisible();
  await expect(tebet.getByRole('button')).toBeHidden(); // Polsek tingkat terbawah

  await page.getByLabel('Cari satuan').fill('tebet');
  await expect(tebet).toBeVisible();
  await expect(page.getByRole('row', { name: /Polda Metro Jaya/ })).toBeVisible(); // induk tetap terlihat
  await expect(page.getByRole('row', { name: /Polda Bali/ })).toBeHidden();

  await page.getByLabel('Cari satuan').fill('');
  await page.getByRole('combobox', { name: 'Saring satuan' }).click();
  await page.getByRole('option', { name: 'Ada laporan prioritas' }).click();
  await expect(page.getByRole('row', { name: /Polda Bali/ })).toBeHidden();
  await page.getByLabel('Cari satuan').fill('zzzz');
  await expect(page.getByText('Tidak ada satuan')).toBeVisible();
});
