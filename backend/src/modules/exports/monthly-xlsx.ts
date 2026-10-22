import ExcelJS from 'exceljs';
import { CATEGORY_LABEL, MonthlyReport } from './monthly-report.service';

const NAVY = 'FF1E3A8A';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
const ZEBRA: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
const RP = '"Rp" #,##0';
const NUM = '#,##0';
const PCT = '0.0"%"';

type Col = { header: string; key: string; width: number; fmt?: string };

/** Lembar tabel: judul, header berwarna, baris belang, kolom beku & filter otomatis. */
function table(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: object[], note?: string) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: NAVY } };
  if (note) { ws.getCell('A2').value = note; ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748B' } }; }
  const head = ws.getRow(3);
  cols.forEach((c, i) => { head.getCell(i + 1).value = c.header; });
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = HEADER_FILL;
  head.alignment = { vertical: 'middle', wrapText: true };
  head.height = 30;
  rows.forEach((r, i) => {
    const row = ws.addRow(cols.map((c) => (r as Record<string, unknown>)[c.key] ?? null));
    if (i % 2) row.fill = ZEBRA;
  });
  if (rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: cols.length } };
  return ws;
}

export async function monthlyXlsx(r: MonthlyReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lapor Bhabinkamtibmas';
  wb.created = r.dibuat;
  const periode = `${r.dari} s.d. ${r.sampai}${r.berjalan ? ' (bulan berjalan)' : ''} · ${r.hariKerja} hari kerja (Senin–Jumat)`;

  // Ringkasan
  const ws = wb.addWorksheet('Ringkasan');
  ws.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 14 }];
  const put = (row: (string | number | null)[], opts: { bold?: boolean; size?: number; color?: string; fmt?: string } = {}) => {
    const x = ws.addRow(row);
    x.font = { bold: opts.bold, size: opts.size, color: opts.color ? { argb: opts.color } : undefined };
    if (opts.fmt) x.eachCell((c, i) => { if (i > 1) c.numFmt = opts.fmt!; });
    return x;
  };
  put([`Laporan Bulanan Bhabinkamtibmas — ${r.bulanLabel}`], { bold: true, size: 15, color: NAVY });
  put([`${r.unit.levelLabel} · ${r.unit.nama}`], { bold: true, size: 12 });
  put([`Periode ${periode}`], { color: 'FF64748B' });
  put([`Dibuat ${r.dibuat.toLocaleString('id-ID', { timeZone: r.unit.timezone })} oleh ${r.dibuatOleh}. Tidak memuat NIK/No. KK maupun data kesehatan per orang.`], { color: 'FF64748B' });
  put([]);
  const s = r.ringkasan;
  const kv = (k: string, v: number | string | null, fmt = NUM) => { const x = put([k, v]); x.getCell(2).numFmt = fmt; x.getCell(1).font = { color: { argb: 'FF475569' } }; x.getCell(2).font = { bold: true }; };
  put(['Ringkasan'], { bold: true, color: NAVY });
  kv('Laporan terkirim', s.laporan);
  kv('Laporan bulan sebelumnya', s.laporanSebelumnya);
  kv('Laporan prioritas', s.prioritas);
  kv('Lokasi perlu dicek', s.lokasiJanggal);
  kv('Bhabinkamtibmas', s.bhabin);
  kv('Bhabin yang melapor', s.bhabinAktif);
  kv('Kehadiran (absen masuk / hari kerja)', s.kehadiranPersen, PCT);
  kv('Absen terlambat', s.terlambat);
  put([]);
  const head = put(['Kategori', 'Bulan ini', 'Bulan lalu', 'Prioritas'], { bold: true });
  head.eachCell((c) => { c.fill = HEADER_FILL; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
  for (const c of r.perKategori) put([c.label, c.jumlah, c.sebelumnya, c.prioritas], { fmt: NUM });
  put([]);
  const k = r.keluarga;
  put(['Keluarga & stunting (Mapping bulan ini)'], { bold: true, color: NAVY });
  kv('Keluarga terdata', k.kk);
  kv('Balita', k.balita);
  kv('Stunting', k.stunting);
  kv('Berisiko stunting', k.berisiko);
  kv('Stunting/berisiko belum ditangani', k.belumDitangani);
  kv('Ibu hamil (KEK/anemia)', `${k.ibuHamil} (${k.ibuKek})`, '@');
  kv('Jamban tidak layak', k.jambanTidakLayak);
  kv('Air minum tidak layak', k.airTidakLayak);

  if (r.perSatuan.length) {
    table(wb, 'Per Satuan', `Rekap per satuan — ${r.bulanLabel}`, [
      { header: 'Satuan', key: 'nama', width: 34 }, { header: 'Tingkat', key: 'level', width: 10 },
      { header: 'Bhabin', key: 'bhabin', width: 10, fmt: NUM }, { header: 'Bhabin melapor', key: 'bhabinAktif', width: 12, fmt: NUM },
      { header: 'Laporan', key: 'laporan', width: 11, fmt: NUM }, { header: 'Prioritas', key: 'prioritas', width: 10, fmt: NUM },
      { header: 'Lokasi dicek', key: 'lokasiJanggal', width: 11, fmt: NUM }, { header: 'Hari hadir', key: 'hadir', width: 11, fmt: NUM },
      { header: 'Terlambat', key: 'terlambat', width: 11, fmt: NUM }, { header: 'Kehadiran %', key: 'kehadiranPersen', width: 12, fmt: PCT },
    ], r.perSatuan, periode);
  }

  table(wb, 'Bhabin', `Kinerja Bhabinkamtibmas — ${r.bulanLabel}`, [
    { header: 'NRP', key: 'nrp', width: 12 }, { header: 'Nama', key: 'nama', width: 26 }, { header: 'Pangkat', key: 'pangkat', width: 10 },
    { header: 'Satuan', key: 'satuan', width: 26 }, { header: 'Desa binaan', key: 'desa', width: 22 },
    { header: 'Laporan', key: 'laporan', width: 10, fmt: NUM },
    ...Object.entries(CATEGORY_LABEL).filter(([c]) => c !== 'PENYULUHAN').map(([c, label]) => ({ header: label, key: c, width: 11, fmt: NUM })),
    { header: 'Lokasi dicek', key: 'lokasiJanggal', width: 10, fmt: NUM }, { header: 'Hari hadir', key: 'hadir', width: 10, fmt: NUM },
    { header: 'Terlambat', key: 'terlambat', width: 10, fmt: NUM }, { header: 'Laporan terakhir', key: 'terakhir', width: 18, fmt: 'dd/mm/yyyy hh:mm' },
  ], r.bhabin.map((b) => ({ ...b, ...b.perKategori })), `${periode}${r.bhabinTerpotong ? ' · dipotong: terlalu banyak baris' : ''} · urut dari laporan paling sedikit`);

  table(wb, 'Prioritas', `Laporan prioritas — ${r.bulanLabel}`, [
    { header: 'Nomor', key: 'nomor', width: 30 }, { header: 'Tanggal', key: 'tanggal', width: 17, fmt: 'dd/mm/yyyy hh:mm' },
    { header: 'Kategori', key: 'kategori', width: 20 }, { header: 'Desa', key: 'desa', width: 22 }, { header: 'Bhabin', key: 'bhabin', width: 26 },
    { header: 'Ringkasan', key: 'ringkasan', width: 70 },
  ], r.prioritas, 'Maksimal 100 laporan terbaru');

  table(wb, 'Harga Pangan', `Harga pangan — ${r.bulanLabel}`, [
    { header: 'Komoditas', key: 'komoditas', width: 24 }, { header: 'Satuan', key: 'satuan', width: 8 },
    { header: 'Rata-rata', key: 'rata2', width: 14, fmt: RP }, { header: 'Bulan lalu', key: 'sebelumnya', width: 14, fmt: RP },
    { header: 'Perubahan %', key: 'perubahan', width: 12, fmt: '+0.0"%";-0.0"%";0.0"%"' }, { header: 'Terendah', key: 'minimum', width: 13, fmt: RP },
    { header: 'Tertinggi', key: 'maksimum', width: 13, fmt: RP }, { header: 'Sampel', key: 'sampel', width: 9, fmt: NUM },
    { header: 'Stok kosong', key: 'kosong', width: 11, fmt: NUM },
  ], r.harga);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
