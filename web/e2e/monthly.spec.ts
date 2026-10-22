import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test('laporan bulanan: pratinjau dan unduh PDF & Excel', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/laporan-bulanan');
  await expect(page.getByRole('heading', { name: 'Laporan Bulanan' })).toBeVisible();
  await expect(page.getByText('Laporan per kategori')).toBeVisible();
  // Menu "Laporan" tidak ikut aktif di /laporan-bulanan.
  await expect(page.locator('nav a[aria-current="page"]', { hasText: /^Laporan$/ })).toHaveCount(0);

  for (const [label, ext, magic] of [['Unduh PDF', 'pdf', '%PDF'], ['Unduh Excel', 'xlsx', 'PK']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: label }).click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`^laporan-bulanan-.+-\\d{4}-\\d{2}\\.${ext}$`));
    const { readFileSync } = await import('fs');
    expect(readFileSync((await dl.path())!).subarray(0, magic.length).toString()).toBe(magic);
  }
});
