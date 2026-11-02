import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test('sidebar diciutkan: submenu Laporan terbuka sebagai panel dan bisa dipilih', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.getByRole('button', { name: /sidebar|menu samping/i }).first().click();
  const trigger = page.getByRole('button', { name: 'Buka menu Laporan' });
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Laporan' });
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await trigger.click();
  await page.mouse.click(900, 500);
  await expect(menu).toBeHidden();

  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Deteksi Dini' }).click();
  await expect(page).toHaveURL(/category=DETEKSI_DINI/);
  await expect(page.getByRole('heading', { name: 'Deteksi Dini' }).first()).toBeVisible();
  await expect(menu).toBeHidden();

  await trigger.click();
  await menu.getByRole('menuitem', { name: /^Semua/ }).click();
  await expect(page).toHaveURL(/\/laporan$/);
});
