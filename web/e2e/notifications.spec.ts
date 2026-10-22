import { expect, test } from '@playwright/test';
import { ACCOUNTS, createSubmittedReport, login } from './helpers';

test('laporan Deteksi Dini urgensi tinggi memberi notifikasi ke pimpinan', async ({ page }) => {
  const uraian = `Uji notifikasi ${Date.now()}`;
  const report = await createSubmittedReport('notifikasi', {
    category: 'DETEKSI_DINI',
    photoField: 'foto_lapangan',
    data: { kategori_kerawanan: 'Gesekan Antarkelompok', urgensi: 'Tinggi', uraian },
  });

  await login(page, ACCOUNTS.pimpinan);
  const bell = page.getByRole('button', { name: /Notifikasi/ });
  await expect(bell).toHaveAccessibleName(/belum dibaca/, { timeout: 10_000 });
  await bell.click();
  const item = page.getByRole('button', { name: new RegExp(uraian) });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/laporan/${report.id}`));

  await page.goto('/notifikasi');
  await expect(page.getByRole('heading', { name: 'Notifikasi', exact: true })).toBeVisible();
  await expect(page.getByText(uraian)).toBeVisible();
});
