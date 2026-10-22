import { FormSchemaJson, isPriority, mergeSecret, mergeSensitive, splitSensitive, validateReportData } from './report-validator';

const schema: FormSchemaJson = {
  category: 'DETEKSI_DINI',
  version: 1,
  title: 'Deteksi Dini',
  fields: [
    { key: 'urgensi', label: 'Urgensi', type: 'select', required: true, options: ['Rendah', 'Tinggi'] },
    { key: 'uraian', label: 'Uraian', type: 'textarea', required: true, maxLength: 10 },
    { key: 'jumlah', label: 'Jumlah', type: 'number', min: 1 },
    { key: 'nik', label: 'NIK', type: 'nik', sensitive: true },
    { key: 'dok', label: 'Dokumen', type: 'file', requiredIf: { field: 'urgensi', equals: 'Tinggi' }, max: 2 },
    { key: 'foto', label: 'Foto', type: 'photo', required: true, min: 1, max: 3 },
    {
      key: 'items', label: 'Harga', type: 'repeater', min: 1,
      fields: [
        { key: 'commodityId', label: 'Komoditas', type: 'select', required: true, source: 'commodities' },
        { key: 'harga', label: 'Harga', type: 'currency', required: true, min: 100 },
      ],
    },
  ],
  rules: [{ when: { field: 'urgensi', equals: 'Tinggi' }, then: { flag: 'PRIORITY' } }],
};
const ctx = { commodityIds: new Set([1, 2]), attachmentCounts: { foto: 1 } as Record<string, number> };

describe('validateReportData', () => {
  it('lolos untuk isian valid', () => {
    expect(validateReportData(schema, { urgensi: 'Rendah', uraian: 'ok', items: [{ commodityId: 1, harga: 5000 }] }, ctx)).toEqual([]);
  });

  it('menolak field wajib kosong, pilihan asing, teks terlalu panjang, dan field tak dikenal', () => {
    const errs = validateReportData(schema, { urgensi: 'Sedang', uraian: 'terlalu panjang sekali', asing: 1 }, ctx).map((e) => e.field);
    expect(errs).toEqual(expect.arrayContaining(['urgensi', 'uraian', 'asing']));
  });

  it('memeriksa lampiran wajib, requiredIf, dan batas maksimal', () => {
    const errs = validateReportData(schema, { urgensi: 'Tinggi', uraian: 'ok' }, { ...ctx, attachmentCounts: { foto: 4 } }).map((e) => e.field);
    expect(errs).toEqual(expect.arrayContaining(['dok', 'foto']));
  });

  it('melewati cek lampiran saat attachmentCounts null (draft)', () => {
    expect(validateReportData(schema, { urgensi: 'Rendah', uraian: 'ok' }, { ...ctx, attachmentCounts: null })).toEqual([]);
  });

  it('memvalidasi baris repeater, NIK, dan angka', () => {
    const errs = validateReportData(schema, { urgensi: 'Rendah', uraian: 'ok', nik: '123', jumlah: 0, items: [{ commodityId: 9, harga: 50 }] }, ctx).map((e) => e.field);
    expect(errs).toEqual(expect.arrayContaining(['nik', 'jumlah', 'items[0].commodityId', 'items[0].harga']));
  });
});

describe('isPriority & splitSensitive', () => {
  it('menandai prioritas sesuai aturan skema', () => {
    expect(isPriority(schema, { urgensi: 'Tinggi' })).toBe(true);
    expect(isPriority(schema, { urgensi: 'Rendah' })).toBe(false);
  });

  it('memisahkan field sensitif', () => {
    expect(splitSensitive(schema, { nik: '1234567890123456', urgensi: 'Rendah' })).toEqual({ plain: { urgensi: 'Rendah' }, secret: { nik: '1234567890123456' } });
  });
});

describe('isian bersyarat & sensitif bertingkat (Mapping Data Keluarga v2)', () => {
  const schema = {
    category: 'MAPPING_KK', version: 2, title: 'Uji',
    fields: [
      { key: 'no_kk', label: 'Nomor KK', type: 'nik', required: true, sensitive: true },
      { key: 'kk_pekerjaan', label: 'Pekerjaan', type: 'select', required: true, options: ['PNS', 'Petani'] },
      { key: 'kk_pekerjaan_ket', label: 'Keterangan', type: 'text', requiredIf: { field: 'kk_pekerjaan', in: ['PNS'] } },
      {
        key: 'anggota', label: 'Anggota', type: 'repeater', fields: [
          { key: 'nama', label: 'Nama', type: 'text', required: true },
          { key: 'nik', label: 'NIK', type: 'nik', sensitive: true },
          { key: 'pekerjaan', label: 'Pekerjaan', type: 'select', required: true, options: ['PNS', 'Petani'] },
          { key: 'pekerjaan_ket', label: 'Keterangan', type: 'text', requiredIf: { field: 'pekerjaan', in: ['PNS'] } },
        ],
      },
    ],
  } as unknown as FormSchemaJson;
  const ctx = { commodityIds: new Set<number>(), attachmentCounts: null };

  it('keterangan pekerjaan wajib hanya untuk pekerjaan tertentu, juga di baris anggota', () => {
    const errs = validateReportData(schema, {
      no_kk: '3201010101010001', kk_pekerjaan: 'PNS',
      anggota: [{ nama: 'A', pekerjaan: 'PNS' }, { nama: 'B', pekerjaan: 'Petani' }],
    }, ctx).map((e) => e.field);
    expect(errs).toEqual(['kk_pekerjaan_ket', 'anggota[0].pekerjaan_ket']);
  });

  it('NIK anggota dipisah per baris lalu digabung kembali; NIK kosong saat ralat mempertahankan yang lama', () => {
    const { plain, secret } = splitSensitive(schema, { no_kk: '3201010101010001', anggota: [{ nama: 'A', nik: '3201010101010002' }, { nama: 'B' }] });
    expect(plain).toEqual({ anggota: [{ nama: 'A' }, { nama: 'B' }] });
    expect(secret).toEqual({ no_kk: '3201010101010001', anggota: [{ nik: '3201010101010002' }, {}] });
    expect(mergeSensitive(plain, secret)).toEqual({ no_kk: '3201010101010001', anggota: [{ nama: 'A', nik: '3201010101010002' }, { nama: 'B' }] });
    const ralat = splitSensitive(schema, { anggota: [{ nama: 'A2' }, { nama: 'B', nik: '3201010101010003' }] }).secret;
    expect(mergeSecret(secret, ralat)).toEqual({ no_kk: '3201010101010001', anggota: [{ nik: '3201010101010002' }, { nik: '3201010101010003' }] });
  });
});

describe('nomor HP / WhatsApp', () => {
  const schema = { category: 'X', version: 1, title: 'Uji', fields: [{ key: 'hp', label: 'No. HP', type: 'phone' }] } as unknown as FormSchemaJson;
  const ctx = { commodityIds: new Set<number>(), attachmentCounts: null };
  it.each(['081234567890', '6281234567890', '+6281234567890', '0812-3456-7890'])('menerima %s', (hp) => {
    expect(validateReportData(schema, { hp }, ctx)).toEqual([]);
  });
  it.each(['12345', '0212345678', 'abc'])('menolak %s', (hp) => {
    expect(validateReportData(schema, { hp }, ctx)).toHaveLength(1);
  });
});

describe('showIf & prioritas repeater (stunting)', () => {
  const s = require('../../../../packages/form-schemas/mapping_kk.v2.json') as FormSchemaJson;
  const dob = (years: number) => `${new Date().getFullYear() - years}-01-01`;
  it('balita stunting belum ditangani → prioritas', () => {
    expect(isPriority(s, { anggota: [{ tanggal_lahir: dob(2), status_stunting: 'Stunting', stunting_ditangani: 'Belum' }] })).toBe(true);
    expect(isPriority(s, { anggota: [{ tanggal_lahir: dob(2), status_stunting: 'Stunting', stunting_ditangani: 'Ya, rutin ke Posyandu/Puskesmas' }] })).toBe(false);
  });
  it('nilai usang di field tersembunyi (bukan balita) tidak memicu prioritas', () => {
    expect(isPriority(s, { anggota: [{ tanggal_lahir: dob(20), status_stunting: 'Stunting', stunting_ditangani: 'Belum' }] })).toBe(false);
  });
  it('"sudah ditangani" wajib bila balita berisiko', () => {
    const errs = validateReportData({ ...s, fields: s.fields.filter((f) => f.key === 'anggota') }, {
      anggota: [{ nama: 'A', hubungan: 'Anak', jenis_kelamin: 'Perempuan', agama: 'Islam', status_perkawinan: 'Belum Kawin', pekerjaan: 'Belum/Tidak Bekerja', tanggal_lahir: dob(1), status_stunting: 'Berisiko stunting' }],
    }, { commodityIds: new Set(), attachmentCounts: null });
    expect(errs.map((e) => e.field)).toContain('anggota[0].stunting_ditangani');
  });
});
