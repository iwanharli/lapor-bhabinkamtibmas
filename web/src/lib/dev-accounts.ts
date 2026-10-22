/**
 * Akun percobaan untuk login cepat di lingkungan lokal (data seed dev, lihat backend/prisma/seed.ts).
 * Hanya dipakai di server; aktif saat `next dev` atau bila DEV_LOGIN=true — tidak pernah di produksi.
 */
export const DEV_PASSWORD = 'Demo#12345';

export interface DevAccount { key: string; nrp: string; label: string; hint: string }

export function devLoginEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.DEV_LOGIN === 'true';
}

/** Superadmin hanya muncul bila NRP & sandinya diisi di web/.env.local (DEV_SUPERADMIN_NRP / DEV_SUPERADMIN_PASSWORD). */
export function devAccounts(): (DevAccount & { password: string })[] {
  const list = [
    { key: 'bhabin', nrp: '90000001', label: 'Bhabinkamtibmas', hint: 'Tampilan lapangan (web/HP)' },
    { key: 'mabes', nrp: '90000007', label: 'Pimpinan Mabes', hint: 'Seluruh Indonesia' },
    { key: 'admin', nrp: '90000004', label: 'Admin Unit', hint: 'Admin Polres Contoh' },
    { key: 'pimpinan', nrp: '90000003', label: 'Pimpinan Polres', hint: 'Contoh Pimpinan' },
    { key: 'pimpinan-polsek', nrp: '90000002', label: 'Pimpinan Polsek', hint: 'Contoh Pimpinan Polsek' },
    { key: 'auditor', nrp: '90000005', label: 'Auditor', hint: 'Auditor Polda Contoh' },
    { key: 'polda', nrp: '99000032', label: 'Pimpinan Polda', hint: 'Jawa Barat (data nasional)' },
  ].map((a) => ({ ...a, password: DEV_PASSWORD }));
  const { DEV_SUPERADMIN_NRP: nrp, DEV_SUPERADMIN_PASSWORD: password } = process.env;
  return nrp && password ? [{ key: 'superadmin', nrp, password, label: 'Superadmin', hint: 'Seluruh Indonesia' }, ...list] : list;
}
