import { ipList } from './integration.guard';
import { IntegrationService } from './integration.service';

describe('IntegrationService.isian', () => {
  const svc = new IntegrationService({} as any) as any;
  const plain = { no_kk: '3578010101010001', kk_nama: 'Budi', jamban: 'Jamban bersama/umum', kk_risiko_ibu: 'Ibu hamil', anggota: [{ _id: 'a', nama: 'Siti', nik: '3578010101900001', risiko_ibu: 'Ibu hamil', status_stunting: 'Stunting' }] };

  it('Mapping KK: No. KK ikut, NIK & isian kesehatan per orang tidak', () => {
    const out = svc.isian(plain);
    expect(out).toEqual({ no_kk: '3578010101010001', kk_nama: 'Budi', jamban: 'Jamban bersama/umum', anggota: [{ _id: 'a', nama: 'Siti' }] });
  });

  it('kategori lain: mempertahankan isian laporan', () => {
    expect(svc.isian({ tanggapan: 'Baik' })).toEqual({ tanggapan: 'Baik' });
  });
});

describe('ipList', () => {
  it('mendukung alamat tunggal, CIDR, dan mengabaikan entri tidak valid', () => {
    const l = ipList(['10.0.0.5', '10.1.0.0/16', 'bukan-ip', '']);
    expect(l.check('10.0.0.5', 'ipv4')).toBe(true);
    expect(l.check('10.1.200.3', 'ipv4')).toBe(true);
    expect(l.check('10.2.0.1', 'ipv4')).toBe(false);
  });
});
