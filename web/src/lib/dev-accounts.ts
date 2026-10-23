/**
 * Akun percobaan untuk login cepat di lingkungan lokal (akun demo yang sama dengan server demo).
 * Hanya dipakai di server; aktif saat `next dev` atau bila DEV_LOGIN=true — tidak pernah di produksi.
 */
export const DEV_PASSWORD = 'BrsDemo2026';

export interface DevAccount { key: string; nrp: string; label: string; hint: string }

export function devLoginEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.DEV_LOGIN === 'true';
}

/** Superadmin hanya muncul bila NRP & sandinya diisi di web/.env.local (DEV_SUPERADMIN_NRP / DEV_SUPERADMIN_PASSWORD). */
export function devAccounts(): (DevAccount & { password: string })[] {
  const list = [
    { key: 'bhabin', nrp: '31740005', label: 'Bhabinkamtibmas', hint: 'Menteng Dalam (web/HP)' },
    { key: 'mabes', nrp: '90000007', label: 'Pimpinan Mabes', hint: 'Seluruh Indonesia' },
    { key: 'polda', nrp: '31000001', label: 'Pimpinan Polda', hint: 'Polda Metro Jaya' },
    { key: 'admin', nrp: '31740002', label: 'Admin Unit', hint: 'Polres Metro Jakarta Selatan' },
    { key: 'pimpinan', nrp: '31740001', label: 'Pimpinan Polres', hint: 'Polres Metro Jakarta Selatan' },
    { key: 'pimpinan-polsek', nrp: '31740004', label: 'Pimpinan Polsek', hint: 'Polsek Tebet' },
    { key: 'auditor', nrp: '31000003', label: 'Auditor', hint: 'Polda Metro Jaya' },
  ].map((a) => ({ ...a, password: DEV_PASSWORD }));
  const { DEV_SUPERADMIN_NRP: nrp, DEV_SUPERADMIN_PASSWORD: password } = process.env;
  return nrp && password ? [{ key: 'superadmin', nrp, password, label: 'Superadmin', hint: 'Seluruh Indonesia' }, ...list] : list;
}
