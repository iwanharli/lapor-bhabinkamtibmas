import { healthSummary } from './health-summary';

describe('healthSummary', () => {
  const at = new Date('2026-10-23T00:00:00Z');
  it('menghitung balita & status stunting menurut umur saat kegiatan', () => {
    const h = healthSummary({
      kk_risiko_ibu: 'Ibu hamil KEK/anemia',
      anggota: [
        { tanggal_lahir: '2024-05-01', status_stunting: 'Stunting', stunting_ditangani: 'Belum' },
        { tanggal_lahir: '2023-01-01', status_stunting: 'Berisiko stunting', stunting_ditangani: 'Ya, rutin ke Posyandu/Puskesmas' },
        { tanggal_lahir: '2025-09-01' },
        { tanggal_lahir: '2010-01-01', status_stunting: 'Stunting' }, // bukan balita: diabaikan
        { tanggal_lahir: '1995-01-01', risiko_ibu: 'Ibu hamil' },
        { tanggal_lahir: '2012-01-01', risiko_ibu: 'Remaja putri anemia' },
      ],
    }, at);
    expect(h).toEqual({ balita: 3, stunting: 1, berisiko: 1, belum_ditangani: 1, belum_diketahui: 1, ibu_hamil: 2, ibu_kek: 1, remaja_anemia: 1 });
  });
  it('tanpa anggota → semua nol', () => {
    expect(Object.values(healthSummary({}, at)).every((n) => n === 0)).toBe(true);
  });
});
