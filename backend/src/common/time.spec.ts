import { localDate, localDateTime, tzOf } from './time';

describe('zona waktu', () => {
  // 22 Okt 2026 16:30 UTC = 23.30 WIB (22 Okt) = 00.30 WITA & 01.30 WIT (23 Okt).
  const d = new Date('2026-10-22T16:30:00Z');

  it('tanggal lokal berbeda di tiap zona', () => {
    expect(localDate(d, 'Asia/Jakarta')).toBe('2026-10-22');
    expect(localDate(d, 'Asia/Makassar')).toBe('2026-10-23');
    expect(localDate(d, 'Asia/Jayapura')).toBe('2026-10-23');
  });

  it('waktu tampilan berlabel WIB/WITA/WIT', () => {
    expect(localDateTime(d, 'Asia/Jakarta')).toMatch(/23\.30 WIB$/);
    expect(localDateTime(d, 'Asia/Makassar')).toMatch(/00\.30 WITA$/);
    expect(localDateTime(d, 'Asia/Jayapura')).toMatch(/01\.30 WIT$/);
  });

  it('zona tak dikenal kembali ke WIB', () => {
    expect(tzOf('Europe/Paris')).toBe('Asia/Jakarta');
    expect(tzOf(null)).toBe('Asia/Jakarta');
  });
});
