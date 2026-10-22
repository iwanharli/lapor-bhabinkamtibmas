import { FormSchemaJson, isPriority, splitSensitive, validateReportData } from './report-validator';

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
