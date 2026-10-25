/**
 * Akun demo untuk login sekali klik (data demo Polda Metro Jaya, sama dengan server demo).
 * Hanya dipakai di server; aktif saat `next dev` atau bila DEV_LOGIN=true — tidak pernah di produksi sungguhan.
 */
export const DEV_PASSWORD = process.env.DEV_PASSWORD ?? 'BrsDemo2026';

export type DemoRole = 'SUPERADMIN' | 'PIMPINAN' | 'ADMIN_UNIT' | 'AUDITOR' | 'BHABIN';

export interface DevAccount { key: string; nrp: string; label: string; hint: string; nama: string; role: DemoRole; group: string }

/** Penjelasan singkat tiap peran untuk modal akun demo. */
export const ROLE_INFO: Record<DemoRole, { label: string; desc: string }> = {
  SUPERADMIN: { label: 'Superadmin', desc: 'Kelola seluruh sistem: pengguna, satuan, desa, formulir.' },
  PIMPINAN: { label: 'Pimpinan', desc: 'Pantau laporan, peta, kinerja & absensi di wilayahnya.' },
  ADMIN_UNIT: { label: 'Admin Unit', desc: 'Kelola akun personel & desa binaan di satuannya.' },
  AUDITOR: { label: 'Auditor', desc: 'Periksa jejak akses data pribadi (hanya-baca).' },
  BHABIN: { label: 'Bhabinkamtibmas', desc: 'Buat laporan lapangan & absensi (tampilan HP).' },
};

export function devLoginEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.DEV_LOGIN === 'true';
}

const POLRES = [
  { kk: '01', nama: 'Kepulauan Seribu', polres: 'Polres Kepulauan Seribu', polsek: 'Polsek Kep. Seribu Utara', bhabin: 'Pulau Harapan',
    orang: ['Kombes Pol Hadi Purnomo', 'Bripka Lina Marlina', 'Kompol Hasan Basri', 'Kompol Arief Budiman', 'Aipda Iwan Wijaya'] },
  { kk: '71', nama: 'Jakarta Pusat', polres: 'Polres Metro Jakarta Pusat', polsek: 'Polsek Gambir', bhabin: 'Gambir',
    orang: ['Kombes Pol Anton Setiawan', 'Bripka Rizky Firmansyah', 'Kompol Indra Gunawan', 'Kompol Danu Saputra', 'Aiptu Rina Siregar'] },
  { kk: '72', nama: 'Jakarta Utara', polres: 'Polres Metro Jakarta Utara', polsek: 'Polsek Penjaringan', bhabin: 'Kamal Muara',
    orang: ['Kombes Pol Gilang Ramadhan', 'Bripka Nurul Aini', 'Kompol Maya Sari', 'Kompol Eka Putra', 'Aiptu Agus Mahendra'] },
  { kk: '73', nama: 'Jakarta Barat', polres: 'Polres Metro Jakarta Barat', polsek: 'Polsek Cengkareng', bhabin: 'Duri Kosambi',
    orang: ['Kombes Pol Wahyu Nugroho', 'Bripka Dimas Prasetyo', 'Kompol Rendra Kusuma', 'Kompol Fauzan Akbar', 'Brigpol Teuku Wibowo'] },
  { kk: '74', nama: 'Jakarta Selatan', polres: 'Polres Metro Jakarta Selatan', polsek: 'Polsek Tebet', bhabin: 'Menteng Dalam',
    orang: ['Kombes Pol Benny Sitorus', 'Bripka Siti Rahmawati', 'Kompol Teguh Santoso', 'Kompol Galih Permana', 'Aipda Dedi Pratama'] },
  { kk: '75', nama: 'Jakarta Timur', polres: 'Polres Metro Jakarta Timur', polsek: 'Polsek Matraman', bhabin: 'Utan Kayu Selatan',
    orang: ['Kombes Pol Fikri Maulana', 'Bripka Yoga Pratama', 'Kompol Wulan Anggraini', 'Kompol Irfan Hakim', 'Brigpol Ketut Sitompul'] },
];

/** NRP 31·KK·000·P — KK kode kab/kota, P: 1 Pimpinan Polres, 2 Admin, 3 Auditor, 4 Pimpinan Polsek, 5 Bhabin. */
export function devAccounts(): (DevAccount & { password: string })[] {
  const pusat = 'Pusat & Polda';
  const list: DevAccount[] = [
    { key: 'superadmin', nrp: '00000001', role: 'SUPERADMIN', label: 'Superadmin', nama: 'Administrator Sistem', hint: 'Mabes · seluruh Indonesia', group: pusat },
    { key: 'mabes', nrp: '90000007', role: 'PIMPINAN', label: 'Pimpinan Mabes', nama: 'Irjen Pol Ahmad Fauzi', hint: 'Seluruh Indonesia', group: pusat },
    { key: 'polda', nrp: '31000001', role: 'PIMPINAN', label: 'Kapolda', nama: 'Irjen Pol Bagus Prakoso', hint: 'Polda Metro Jaya', group: pusat },
    { key: 'polda-admin', nrp: '31000002', role: 'ADMIN_UNIT', label: 'Admin Polda', nama: 'Kompol Sri Wahyuni', hint: 'Polda Metro Jaya', group: pusat },
    { key: 'polda-auditor', nrp: '31000003', role: 'AUDITOR', label: 'Auditor Polda', nama: 'AKBP Taufik Rahman', hint: 'Polda Metro Jaya', group: pusat },
    ...POLRES.flatMap((r) => {
      const base = { group: r.nama };
      return [
        { ...base, key: `${r.kk}-1`, nrp: `31${r.kk}0001`, role: 'PIMPINAN' as const, label: 'Kapolres', nama: r.orang[0], hint: r.polres },
        { ...base, key: `${r.kk}-2`, nrp: `31${r.kk}0002`, role: 'ADMIN_UNIT' as const, label: 'Admin Polres', nama: r.orang[1], hint: r.polres },
        { ...base, key: `${r.kk}-3`, nrp: `31${r.kk}0003`, role: 'AUDITOR' as const, label: 'Auditor Polres', nama: r.orang[2], hint: r.polres },
        { ...base, key: `${r.kk}-4`, nrp: `31${r.kk}0004`, role: 'PIMPINAN' as const, label: 'Kapolsek', nama: r.orang[3], hint: r.polsek },
        { ...base, key: `${r.kk}-5`, nrp: `31${r.kk}0005`, role: 'BHABIN' as const, label: 'Bhabinkamtibmas', nama: r.orang[4], hint: `Desa ${r.bhabin} · ${r.polsek}` },
      ];
    }),
  ];
  return list.map((a) => ({ ...a, password: DEV_PASSWORD }));
}
