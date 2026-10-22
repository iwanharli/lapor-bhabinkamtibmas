import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test('peta stunting: wilayah berwarna, legenda, ganti ukuran', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/peta-stunting');
  await expect(page.getByText(/Tingkat:/)).toBeVisible();
  await expect(page.locator('.map-stunting path.leaflet-interactive').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Stunting & berisiko (% balita)')).toBeVisible();
  await page.getByRole('link', { name: '% jamban' }).click();
  await expect(page).toHaveURL(/metrik=jamban/);
  await expect(page.getByText('Jamban tidak layak (% keluarga)')).toBeVisible();
});
