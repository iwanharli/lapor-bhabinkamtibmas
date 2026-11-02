import { expect, test } from '@playwright/test';
import { createUser, deactivateUser, login } from './helpers';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] });

test('daftar wajah: kamera & detektor berjalan, foto tanpa wajah ditolak server', async ({ page }) => {
  const u = await createUser();
  try {
    await login(page, u.nrp, u.password);
    await page.getByLabel('Sandi sementara').fill(u.password);
    await page.getByLabel('Sandi baru', { exact: true }).fill('SandiE2E2026');
    await page.getByLabel('Ulangi sandi baru').fill('SandiE2E2026');
    await page.getByRole('button', { name: 'Simpan sandi baru' }).click();
    await page.getByLabel(/Pangkat/).fill('Bripka');
    await page.getByLabel(/Jabatan/).fill('Staf');
    await page.getByLabel(/No\. HP/).fill('081234567890');
    await page.getByRole('button', { name: 'Simpan & lanjut' }).click();
    // Kamera palsu tanpa wajah: detektor MediaPipe (aset sendiri) harus jalan dan meminta wajah.
    await expect(page.getByRole('status')).toHaveText(/Arahkan wajah/, { timeout: 30_000 });
    const res = await page.evaluate(async () => {
      const v = document.querySelector('video')!;
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg'));
      const f = new FormData();
      f.set('frontal', blob, 'a.jpg'); f.set('turned', blob, 'b.jpg');
      const r = await fetch('/api/proxy/auth/face/enroll', { method: 'POST', body: f });
      return { status: r.status, body: await r.json() };
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FACE_NOT_FOUND');
  } finally {
    await deactivateUser(u.id, u.adminToken);
  }
});
