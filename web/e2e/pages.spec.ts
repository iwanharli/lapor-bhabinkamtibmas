import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

/** Setiap halaman utama terbuka tanpa galat dan menampilkan isinya. */
const PAGES: { path: string; heading: string; expect: RegExp }[] = [
  { path: '/', heading: 'Ringkasan', expect: /Total laporan/ },
  { path: '/peta', heading: 'Peta Sebaran', expect: /titik laporan/ },
  { path: '/kinerja', heading: 'Kinerja Bhabinkamtibmas', expect: /Rekap per Bhabin/ },
  { path: '/harga-pangan', heading: 'Pemantauan Harga Pangan', expect: /Pilih komoditas/i },
  { path: '/admin/pengguna', heading: 'Pengguna', expect: /NRP/ },
  { path: '/admin/unit', heading: 'Unit', expect: /Struktur unit/ },
  { path: '/admin/desa', heading: 'Desa & Kelurahan', expect: /Peta batas desa/ },
  { path: '/audit', heading: 'Audit log', expect: /Pelaku/i },
];

test('halaman utama admin terbuka tanpa galat', async ({ page }) => {
  const errors: string[] = [];
  let current = '';
  page.on('pageerror', (e) => errors.push(`${current}: ${e.message}`));
  await login(page, ACCOUNTS.admin);
  for (const p of PAGES) {
    current = p.path;
    const res = await page.goto(p.path);
    // Tunggu hidrasi selesai sebelum pindah halaman; galat dari halaman yang ditinggal setengah jalan bukan bug aplikasi.
    await page.waitForLoadState('networkidle');
    expect(res?.status(), p.path).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: p.heading, exact: true }), p.path).toBeVisible();
    await expect(page.locator('main'), p.path).toContainText(p.expect);
  }
  // WebGL tidak tersedia di browser headless (peta iframe); selain itu tidak boleh ada galat.
  expect(errors.filter((e) => !e.includes('WebGL'))).toEqual([]);
});

test('peta menampilkan titik laporan', async ({ page }) => {
  await login(page, ACCOUNTS.pimpinan);
  await page.goto('/peta?hari=30');
  await expect(page.locator('path.leaflet-interactive').first()).toBeVisible({ timeout: 15_000 });
});
