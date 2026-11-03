import { expect, test } from '@playwright/test';
import { ACCOUNTS, API, apiLogin } from './helpers';

test('admin Polres hanya mengelola Polsek wilayahnya', async () => {
  const token = await apiLogin(ACCOUNTS.admin);
  const call = (path: string, init: RequestInit = {}) => fetch(`${API}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
  const polsek = await (await call('/admin/villages/polsek?limit=100')).json() as { meta: { total: number }; data: { nama: string }[] };
  expect(polsek.meta.total).toBeGreaterThanOrEqual(10);
  expect(polsek.data.map((p) => p.nama)).toContain('Polsek Tebet');

  const poldas = await (await call('/admin/villages/polri-units')).json() as { id: string; name: string }[];
  expect(poldas.map((p) => p.name)).toEqual(['Polda Metro Jaya']);
  const polres = await (await call(`/admin/villages/polri-units?parent=${poldas[0].id}`)).json() as { name: string }[];
  expect(polres.map((p) => p.name)).toEqual(['Polres Metro Jakarta Selatan']);

  const outside = await (await call('/admin/villages/polsek?q=Polsek%20Gambir')).json() as { meta: { total: number } };
  expect(outside.meta.total).toBe(0);
});
