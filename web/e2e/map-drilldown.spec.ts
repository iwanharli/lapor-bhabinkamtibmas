import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

/** Klik wilayah pertama yang titik tengahnya mengenai poligonnya, lalu tunggu parameter URL tingkat itu muncul. */
async function openFirstArea(page: Page, param: string) {
  const areas = page.locator('.leaflet-batas-pane path.leaflet-interactive');
  await expect(areas.first()).toBeVisible();
  await page.waitForTimeout(1500); // animasi terbang peta
  const count = await areas.count();
  for (let i = 0; i < count; i++) {
    const box = await areas.nth(i).boundingBox();
    if (!box) continue;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    if (new URL(page.url()).searchParams.has(param)) return;
  }
  throw new Error(`Tidak ada wilayah yang membuka ${param}`);
}

test('peta: klik wilayah turun dari provinsi sampai desa, satuan Polri tampil', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page, ACCOUNTS.admin);
  await page.goto('/peta?provinsiKode=33');
  await expect(page.getByText(/Polda Jateng|Polda Jawa Tengah/)).toBeVisible();
  await expect(page.getByText(/Kabupaten\/Kota · klik untuk membuka/)).toBeVisible();

  await openFirstArea(page, 'kabupatenKode');
  await expect(page.getByText(/Kecamatan · klik untuk membuka/)).toBeVisible();
  await expect(page.getByText(/Polres/).first()).toBeVisible();

  await openFirstArea(page, 'kecamatanKode');
  await expect(page.getByText(/Desa\/Kelurahan · klik untuk membuka/)).toBeVisible();

  await openFirstArea(page, 'desaKode');
  await expect(page.getByLabel('Desa atau kelurahan')).not.toHaveValue('');

  await page.getByRole('button', { name: 'Hapus filter wilayah' }).click();
  await expect(page.getByText(/38 Provinsi · klik untuk membuka/)).toBeVisible();
  expect(errors).toEqual([]);
});
