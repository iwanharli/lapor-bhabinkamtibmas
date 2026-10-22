import { existsSync } from 'fs';
import { resolve } from 'path';
import PDFDocument from 'pdfkit';
import { MonthlyReport } from './monthly-report.service';

const NAVY = '#1e3a8a';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ZEBRA = '#f8fafc';
const RED = '#b91c1c';
const GREEN = '#15803d';
const LOGO = resolve(process.cwd(), 'assets/logo.png');
const M = 40; // margin

const n = (x: number | null | undefined) => (x == null ? '—' : x.toLocaleString('id-ID'));
const rp = (x: number | null | undefined) => (x == null ? '—' : `Rp ${x.toLocaleString('id-ID')}`);
const pct = (x: number | null | undefined) => (x == null ? '—' : `${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const delta = (now: number, prev: number) => (prev ? `${now >= prev ? '+' : ''}${(((now - prev) / prev) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari bulan lalu` : 'bulan lalu: 0');
/** Font standar PDF (WinAnsi): ganti karakter di luar set agar tidak muncul kotak. */
const t = (s: unknown) => String(s ?? '').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[→]/g, '->').replace(/[^\x20-\x7E -ÿ–—‘’“”•…·×]/g, '?');

type Col = { title: string; width: number; align?: 'left' | 'right'; get: (row: any) => string; color?: (row: any) => string | undefined };

export async function monthlyPdf(r: MonthlyReport): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M + 14, left: M, right: M }, bufferPages: true, info: {
    Title: `Laporan Bulanan Bhabinkamtibmas ${r.bulanLabel} - ${r.unit.nama}`, Author: 'Lapor Bhabinkamtibmas', Creator: 'Lapor Bhabinkamtibmas',
  } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(chunks))));
  const W = doc.page.width - M * 2;
  const bottom = () => doc.page.height - M - 20;

  // Kepala laporan
  doc.rect(0, 0, doc.page.width, 92).fill(NAVY);
  if (existsSync(LOGO)) doc.image(LOGO, M, 16, { height: 60 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('Laporan Bulanan Bhabinkamtibmas', M + 74, 22, { width: W - 74 });
  doc.font('Helvetica').fontSize(11).text(t(`${r.unit.levelLabel} · ${r.unit.nama}`), M + 74, 44, { width: W - 74 });
  doc.fontSize(9).fillColor('#c7d2fe').text(t(`${r.bulanLabel} · ${r.dari} s.d. ${r.sampai}${r.berjalan ? ' (bulan berjalan)' : ''} · ${r.hariKerja} hari kerja`), M + 74, 62, { width: W - 74 });
  doc.y = 108;

  const section = (title: string, sub?: string) => {
    if (doc.y > bottom() - 80) doc.addPage();
    doc.moveDown(0.6).fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(t(title), M, doc.y);
    if (sub) doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(t(sub));
    doc.moveDown(0.3);
  };

  const tableOf = (cols: Col[], rows: any[]) => {
    const scale = W / cols.reduce((s, c) => s + c.width, 0);
    const widths = cols.map((c) => c.width * scale);
    const header = () => {
      const y = doc.y;
      doc.rect(M, y, W, 18).fill(NAVY);
      let x = M;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
      cols.forEach((c, i) => { doc.text(t(c.title), x + 4, y + 5, { width: widths[i] - 8, align: c.align ?? 'left', lineBreak: false, ellipsis: true }); x += widths[i]; });
      doc.y = y + 18;
    };
    header();
    rows.forEach((row, ri) => {
      doc.font('Helvetica').fontSize(7.5);
      const h = Math.max(15, ...cols.map((c, i) => doc.heightOfString(t(c.get(row)), { width: widths[i] - 8 }) + 7));
      if (doc.y + h > bottom()) { doc.addPage(); header(); }
      const y = doc.y;
      if (ri % 2) doc.rect(M, y, W, h).fill(ZEBRA);
      let x = M;
      cols.forEach((c, i) => {
        doc.fillColor(c.color?.(row) ?? INK).font('Helvetica').fontSize(7.5).text(t(c.get(row)), x + 4, y + 4, { width: widths[i] - 8, align: c.align ?? 'left' });
        x += widths[i];
      });
      doc.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.y = y + h;
    });
    if (!rows.length) doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8).text('Tidak ada data.', M, doc.y + 4);
    doc.x = M;
  };

  // Kotak angka utama
  const s = r.ringkasan;
  const kpis: [string, string, string, string?][] = [
    ['Laporan terkirim', n(s.laporan), delta(s.laporan, s.laporanSebelumnya)],
    ['Laporan prioritas', n(s.prioritas), delta(s.prioritas, s.prioritasSebelumnya), s.prioritas ? RED : undefined],
    ['Lokasi perlu dicek', n(s.lokasiJanggal), 'di luar desa / lokasi palsu', s.lokasiJanggal ? RED : undefined],
    ['Bhabin melapor', `${n(s.bhabinAktif)} / ${n(s.bhabin)}`, s.bhabin ? `${pct(Math.round((s.bhabinAktif / s.bhabin) * 1000) / 10)} dari seluruh Bhabin` : ''],
    ['Kehadiran', pct(s.kehadiranPersen), `${n(s.hadir)} absen masuk · ${n(s.terlambat)} terlambat`],
    ['Balita stunting belum ditangani', n(r.keluarga.belumDitangani), `${n(r.keluarga.stunting)} stunting · ${n(r.keluarga.berisiko)} berisiko`, r.keluarga.belumDitangani ? RED : undefined],
  ];
  const bw = (W - 16) / 3, bh = 58, y0 = doc.y;
  kpis.forEach(([label, value, sub, color], i) => {
    const x = M + (i % 3) * (bw + 8), y = y0 + Math.floor(i / 3) * (bh + 8);
    doc.roundedRect(x, y, bw, bh, 6).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(t(label), x + 10, y + 8, { width: bw - 20 });
    doc.fillColor(color ?? INK).font('Helvetica-Bold').fontSize(17).text(t(value), x + 10, y + 21, { width: bw - 20 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(t(sub), x + 10, y + 42, { width: bw - 20, lineBreak: false, ellipsis: true });
  });
  doc.x = M;
  doc.y = y0 + 2 * (bh + 8);

  section('Laporan per kategori');
  tableOf([
    { title: 'Kategori', width: 40, get: (c) => c.label },
    { title: 'Bulan ini', width: 15, align: 'right', get: (c) => n(c.jumlah) },
    { title: 'Bulan lalu', width: 15, align: 'right', get: (c) => n(c.sebelumnya) },
    { title: 'Perubahan', width: 15, align: 'right', get: (c) => (c.sebelumnya ? `${c.jumlah >= c.sebelumnya ? '+' : ''}${(((c.jumlah - c.sebelumnya) / c.sebelumnya) * 100).toFixed(1).replace('.', ',')}%` : '—') },
    { title: 'Prioritas', width: 15, align: 'right', get: (c) => n(c.prioritas), color: (c) => (c.prioritas ? RED : undefined) },
  ], r.perKategori);

  const k = r.keluarga;
  section('Keluarga & stunting', 'Dari laporan Mapping Data Keluarga bulan ini; satu KK dihitung sekali. Tanpa data per orang.');
  tableOf([
    { title: 'Keluarga', width: 12, align: 'right', get: () => n(k.kk) },
    { title: 'Balita', width: 12, align: 'right', get: () => n(k.balita) },
    { title: 'Stunting', width: 12, align: 'right', get: () => n(k.stunting), color: () => (k.stunting ? RED : undefined) },
    { title: 'Berisiko', width: 12, align: 'right', get: () => n(k.berisiko) },
    { title: 'Belum ditangani', width: 15, align: 'right', get: () => n(k.belumDitangani), color: () => (k.belumDitangani ? RED : undefined) },
    { title: 'Ibu hamil (KEK)', width: 15, align: 'right', get: () => `${n(k.ibuHamil)} (${n(k.ibuKek)})` },
    { title: 'Jamban tdk layak', width: 15, align: 'right', get: () => n(k.jambanTidakLayak) },
    { title: 'Air tdk layak', width: 13, align: 'right', get: () => n(k.airTidakLayak) },
  ], [k]);

  if (r.perSatuan.length) {
    const top = r.perSatuan.slice(0, 60);
    section('Rekap per satuan', `${r.perSatuan.length} satuan${r.perSatuan.length > top.length ? ` · ${top.length} teratas ditampilkan; lengkap di Excel` : ''}`);
    tableOf([
      { title: 'Satuan', width: 34, get: (u) => u.nama },
      { title: 'Bhabin', width: 9, align: 'right', get: (u) => n(u.bhabin) },
      { title: 'Melapor', width: 9, align: 'right', get: (u) => n(u.bhabinAktif) },
      { title: 'Laporan', width: 10, align: 'right', get: (u) => n(u.laporan) },
      { title: 'Prioritas', width: 10, align: 'right', get: (u) => n(u.prioritas), color: (u) => (u.prioritas ? RED : undefined) },
      { title: 'Lokasi', width: 9, align: 'right', get: (u) => n(u.lokasiJanggal) },
      { title: 'Kehadiran', width: 10, align: 'right', get: (u) => pct(u.kehadiranPersen), color: (u) => (u.kehadiranPersen != null && u.kehadiranPersen < 50 ? RED : undefined) },
      { title: 'Terlambat', width: 10, align: 'right', get: (u) => n(u.terlambat) },
    ], top);
  }

  // Bhabin yang perlu perhatian: tidak melapor, atau kehadiran < 50% hari kerja.
  const perhatian = r.bhabin.filter((b) => b.laporan === 0 || (r.hariKerja && b.hadir / r.hariKerja < 0.5));
  const shown = perhatian.slice(0, 40);
  section('Bhabin perlu perhatian', `Tidak mengirim laporan atau kehadiran di bawah 50% hari kerja: ${n(perhatian.length)} orang${perhatian.length > shown.length ? ` · ${shown.length} ditampilkan; lengkap di Excel` : ''}`);
  tableOf([
    { title: 'NRP', width: 12, get: (b) => b.nrp },
    { title: 'Nama', width: 28, get: (b) => [b.pangkat, b.nama].filter(Boolean).join(' ') },
    { title: 'Satuan', width: 24, get: (b) => b.satuan },
    { title: 'Desa binaan', width: 20, get: (b) => b.desa ?? '—' },
    { title: 'Laporan', width: 9, align: 'right', get: (b) => n(b.laporan), color: (b) => (b.laporan ? undefined : RED) },
    { title: 'Hari hadir', width: 9, align: 'right', get: (b) => `${n(b.hadir)}/${r.hariKerja}`, color: (b) => (r.hariKerja && b.hadir / r.hariKerja < 0.5 ? RED : undefined) },
  ], shown);

  const pr = r.prioritas.slice(0, 25);
  section('Laporan prioritas', `${n(r.prioritas.length)} laporan${r.prioritas.length > pr.length ? ` · ${pr.length} terbaru ditampilkan` : ''}`);
  tableOf([
    { title: 'Tanggal', width: 12, get: (p) => p.tanggal.toLocaleDateString('id-ID', { timeZone: r.unit.timezone, day: '2-digit', month: 'short' }) },
    { title: 'Kategori', width: 15, get: (p) => p.kategori },
    { title: 'Desa', width: 16, get: (p) => p.desa },
    { title: 'Bhabin', width: 20, get: (p) => p.bhabin },
    { title: 'Ringkasan', width: 45, get: (p) => p.ringkasan || '—' },
  ], pr);

  section('Harga pangan', 'Rata-rata laporan harga bulan ini dibanding bulan lalu');
  tableOf([
    { title: 'Komoditas', width: 26, get: (h) => `${h.komoditas} (${h.satuan})` },
    { title: 'Rata-rata', width: 15, align: 'right', get: (h) => rp(h.rata2) },
    { title: 'Bulan lalu', width: 15, align: 'right', get: (h) => rp(h.sebelumnya) },
    { title: 'Perubahan', width: 11, align: 'right', get: (h) => (h.perubahan == null ? '—' : `${h.perubahan > 0 ? '+' : ''}${pct(h.perubahan)}`),
      color: (h) => (h.perubahan == null ? undefined : h.perubahan >= 10 ? RED : h.perubahan <= -10 ? GREEN : undefined) },
    { title: 'Rentang', width: 22, align: 'right', get: (h) => (h.minimum == null ? '—' : `${rp(h.minimum)} – ${rp(h.maksimum)}`) },
    { title: 'Sampel', width: 9, align: 'right', get: (h) => n(h.sampel) },
  ], r.harga);

  // Kaki halaman
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Menulis di area margin bawah memicu halaman baru di pdfkit: nolkan sementara.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - M + 4;
    doc.moveTo(M, y - 6).lineTo(M + W, y - 6).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7)
      .text(t(`Lapor Bhabinkamtibmas · ${r.unit.nama} · ${r.bulanLabel} · dibuat ${r.dibuat.toLocaleString('id-ID', { timeZone: r.unit.timezone })} oleh ${r.dibuatOleh}`), M, y, { width: W - 60, lineBreak: false, ellipsis: true })
      .text(`Hal. ${i + 1}/${range.count}`, M + W - 60, y, { width: 60, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}
