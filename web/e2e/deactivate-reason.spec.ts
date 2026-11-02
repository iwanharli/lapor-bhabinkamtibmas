import { expect, test } from '@playwright/test';
import { API, apiLogin, ACCOUNTS, createUser, deactivateUser, login } from './helpers';

test('menonaktifkan akun wajib memberi alasan', async ({ page }) => {
  const u = await createUser();
  const patch = (body: unknown) => fetch(`${API}/admin/users/${u.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${u.adminToken}` }, body: JSON.stringify(body) });
  try {
    expect((await patch({ active: false })).status).toBe(400);
    expect((await patch({ active: false, deactivatedReason: '  ab ' })).status).toBe(400);

    await login(page, ACCOUNTS.admin);
    await page.goto(`/admin/pengguna/${u.id}`);
    await expect(page.getByLabel('Alasan menonaktifkan')).toBeHidden();
    await page.getByLabel('Aktif', { exact: true }).uncheck();
    await page.getByRole('button', { name: /Simpan/ }).first().click();
    await expect(page.getByText(/Isi alasan menonaktifkan/)).toBeVisible();
    await page.getByLabel(/Alasan menonaktifkan/).fill('Pindah tugas ke Polres lain');
    await page.getByRole('button', { name: /Simpan/ }).first().click();
    await expect(page.getByText(/Dinonaktifkan.*Pindah tugas ke Polres lain/)).toBeVisible();

    // Diaktifkan kembali: alasan hilang, tanpa perlu alasan.
    const on = await patch({ active: true });
    expect(on.ok).toBeTruthy();
    expect((await on.json() as { deactivatedReason: string | null }).deactivatedReason).toBeNull();
    // Mengubah data lain tidak meminta alasan.
    expect((await patch({ jabatan: 'Uji' })).ok).toBeTruthy();
  } finally {
    await deactivateUser(u.id, await apiLogin(ACCOUNTS.admin));
  }
});
