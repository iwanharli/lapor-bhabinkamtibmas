import { existsSync } from 'fs';
import { resolve } from 'path';
import PDFDocument from 'pdfkit';
import { MonthlyReport } from './monthly-report.service';

const NAVY = '#1e3a8a';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const ZEBRA = '#f8fafc';
const SOFT = '#eef2ff';
const RED = '#b91c1c';
const RED_SOFT = '#fef2f2';
const GREEN = '#15803d';
const LOGO = resolve(process.cwd(), 'assets/logo.png');
const M = 40; // margin
const KLASIFIKASI = 'TERBATAS';
/** Persentase perubahan tidak ditampilkan bila pembanding terlalu kecil (mis. 1 → 5 = +400% menyesatkan). */
const MIN_BASE = 5;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const n = (x: number | null | undefined) => (x == null ? '—' : x.toLocaleString('id-ID'));
const rp = (x: number | null | undefined) => (x == null ? '—' : `Rp ${x.toLocaleString('id-ID')}`);
const pct = (x: number | null | undefined) => (x == null ? '—' : `${x.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`);
const change = (now: number, prev: number) => (prev >= MIN_BASE ? Math.round(((now - prev) / prev) * 1000) / 10 : null);
const signed = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${pct(v)}`);
const tanggal = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** Font standar PDF (WinAnsi): ganti karakter di luar set agar tidak muncul kotak. */
const t = (s: unknown) => String(s ?? '').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[→]/g, '->').replace(/[^\x20-\x7E -ÿ–—‘’“”•…·×]/g, '?');

type Col = {
  title: string; width: number; align?: 'left' | 'right'; get: (row: any) => string; color?: (row: any) => string | undefined;
  /** Batang mini 0..1 di belakang teks sel. */
  bar?: (row: any) => number;
};

export async function monthlyPdf(r: MonthlyReport): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M + 14, left: M, right: M }, bufferPages: true, info: {
    Title: `Laporan Bulanan Bhabinkamtibmas ${r.bulanLabel} - ${r.unit.nama}`, Author: 'Lapor Bhabinkamtibmas', Creator: 'Lapor Bhabinkamtibmas', Subject: r.nomor,
  } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(chunks))));
  const W = doc.page.width - M * 2;
  const bottom = () => doc.page.height - M - 20;
  const s = r.ringkasan;
  const vs = `vs ${r.pembanding.label}`;

  // ---------- Kop surat & judul ----------
  const kopW = 250;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5);
  r.kop.forEach((line, i) => doc.text(t(line), M, M + i * 11, { width: kopW, align: 'center' }));
  const kopBottom = M + r.kop.length * 11 + 2;
  doc.moveTo(M + 10, kopBottom).lineTo(M + kopW - 10, kopBottom).lineWidth(0.8).strokeColor(INK).stroke();
  // Klasifikasi
  doc.font('Helvetica-Bold').fontSize(8);
  const kw = doc.widthOfString(KLASIFIKASI) + 16;
  doc.rect(M + W - kw, M, kw, 16).lineWidth(0.8).strokeColor(RED).stroke();
  doc.fillColor(RED).text(KLASIFIKASI, M + W - kw, M + 4.5, { width: kw, align: 'center' });

  let y = kopBottom + 16;
  if (existsSync(LOGO)) doc.image(LOGO, doc.page.width / 2 - 21, y, { height: 42 });
  y += 48;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14).text('LAPORAN BULANAN BHABINKAMTIBMAS', M, y, { width: W, align: 'center' });
  doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(t(`${r.unit.nama} · ${r.bulanLabel}`), M, doc.y + 2, { width: W, align: 'center' });
  doc.fillColor(MUTED).fontSize(8).text(t(
    `Nomor: ${r.nomor} · Periode ${tanggal(r.dari)} s.d. ${tanggal(r.sampai)}${r.berjalan ? ' (bulan berjalan)' : ''} · ${r.hariKerja} hari kerja · pembanding ${r.pembanding.label}`,
  ), M, doc.y + 2, { width: W, align: 'center' });
  doc.y += 10;

  /** Blok berposisi tetap (kotak, grafik, grid): pindah halaman dulu bila tidak muat, agar pdfkit tidak memecah per baris. */
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) {
      doc.addPage();
      doc.y = M;
    }
  };

  const section = (title: string, sub?: string, need = 80) => {
    if (doc.y > bottom() - need) doc.addPage();
    doc.moveDown(0.7).fillColor(NAVY).font('Helvetica-Bold').fontSize(11.5).text(t(title), M, doc.y);
    if (sub) doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(t(sub), M, doc.y, { width: W });
    doc.moveDown(0.35);
  };

  const tableOf = (cols: Col[], rows: any[], opts: { total?: any; highlight?: (row: any) => boolean } = {}) => {
    const scale = W / cols.reduce((sum, c) => sum + c.width, 0);
    const widths = cols.map((c) => c.width * scale);
    const header = () => {
      const hy = doc.y;
      doc.rect(M, hy, W, 18).fill(NAVY);
      let x = M;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
      cols.forEach((c, i) => { doc.text(t(c.title), x + 4, hy + 5, { width: widths[i] - 8, align: c.align ?? 'left', lineBreak: false, ellipsis: true }); x += widths[i]; });
      doc.y = hy + 18;
    };
    header();
    const drawRow = (row: any, ri: number, total = false) => {
      const font = total ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(font).fontSize(7.5);
      const h = Math.max(15, ...cols.map((c, i) => doc.heightOfString(t(c.get(row)), { width: widths[i] - 8 }) + 7));
      if (doc.y + h > bottom()) { doc.addPage(); header(); }
      const ry = doc.y;
      if (total) doc.rect(M, ry, W, h).fill(SOFT);
      else if (opts.highlight?.(row)) doc.rect(M, ry, W, h).fill(RED_SOFT);
      else if (ri % 2) doc.rect(M, ry, W, h).fill(ZEBRA);
      let x = M;
      cols.forEach((c, i) => {
        const frac = !total && c.bar ? Math.max(0, Math.min(1, c.bar(row))) : 0;
        if (frac > 0) doc.roundedRect(x + 4, ry + h - 5, (widths[i] - 8) * frac, 2.5, 1.2).fill('#93c5fd');
        doc.fillColor(c.color?.(row) ?? INK).font(font).fontSize(7.5).text(t(c.get(row)), x + 4, ry + 4, { width: widths[i] - 8, align: c.align ?? 'left' });
        x += widths[i];
      });
      doc.moveTo(M, ry + h).lineTo(M + W, ry + h).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.y = ry + h;
    };
    rows.forEach((row, ri) => drawRow(row, ri));
    if (opts.total) drawRow(opts.total, 0, true);
    doc.x = M;
  };

  const note = (text: string) => {
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(7).text(t(text), M, doc.y + 3, { width: W });
    doc.x = M;
  };

  // ---------- Ringkasan naratif ----------
  const topKat = [...r.perKategori].sort((a, b) => b.jumlah - a.jumlah)[0];
  const naik = r.harga.filter((h) => h.perubahan != null && h.perubahan >= 10);
  const perhatian = r.bhabin.filter((b) => b.laporan === 0 || (r.hariKerja && b.hadir / r.hariKerja < 0.5));
  const dLap = change(s.laporan, s.laporanSebelumnya);
  const kalimat = [
    `Selama periode ini masuk ${n(s.laporan)} laporan dari ${n(s.bhabinAktif)} dari ${n(s.bhabin)} Bhabinkamtibmas`
      + `${dLap == null ? '' : ` (${dLap >= 0 ? 'naik' : 'turun'} ${pct(Math.abs(dLap))} ${vs})`}`
      + `${topKat ? `; kegiatan terbanyak ${topKat.label} (${n(topKat.jumlah)} laporan)` : ''}.`,
    s.prioritas ? `Terdapat ${n(s.prioritas)} laporan deteksi dini urgensi tinggi yang perlu ditindaklanjuti.` : 'Tidak ada laporan deteksi dini urgensi tinggi.',
    s.kehadiranPersen != null ? `Kehadiran rata-rata ${pct(s.kehadiranPersen)} dari hari kerja${s.kehadiranPersen < 75 ? ', di bawah 75% dan perlu dibina' : ''}; ${n(perhatian.length)} Bhabin perlu perhatian.` : '',
    s.lokasiJanggal ? `${n(s.lokasiJanggal)} laporan memiliki lokasi yang perlu dicek.` : '',
    naik.length ? `Harga ${naik.map((h) => `${h.komoditas} (+${pct(h.perubahan)})`).join(', ')} naik 10% atau lebih dibanding pembanding.` : 'Tidak ada lonjakan harga pangan 10% atau lebih.',
    r.keluarga.belumDitangani ? `${n(r.keluarga.belumDitangani)} balita stunting/berisiko belum ditangani.` : '',
  ].filter(Boolean).join(' ');
  const ny = doc.y;
  doc.font('Helvetica').fontSize(8.5);
  const nh = doc.heightOfString(t(kalimat), { width: W - 24, lineGap: 1.5 }) + 26;
  doc.roundedRect(M, ny, W, nh, 6).fill(SOFT);
  doc.rect(M, ny, 3, nh).fill(NAVY);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8).text('RINGKASAN', M + 12, ny + 8);
  doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(t(kalimat), M + 12, ny + 19, { width: W - 24, lineGap: 1.5 });
  doc.y = ny + nh + 10;

  // ---------- Kotak angka utama ----------
  const deltaText = (now: number, prev: number) => {
    const d = change(now, prev);
    return d == null ? `${vs}: ${n(prev)}` : `${signed(d)} ${vs}`;
  };
  const kpis: [string, string, string, string?][] = [
    ['Laporan terkirim', n(s.laporan), deltaText(s.laporan, s.laporanSebelumnya)],
    ['Deteksi dini urgensi tinggi', n(s.prioritas), deltaText(s.prioritas, s.prioritasSebelumnya), s.prioritas ? RED : undefined],
    ['Lokasi perlu dicek', n(s.lokasiJanggal), 'di luar desa / lokasi palsu', s.lokasiJanggal ? RED : undefined],
    ['Bhabin melapor', `${n(s.bhabinAktif)} / ${n(s.bhabin)}`, s.bhabin ? `${pct(Math.round((s.bhabinAktif / s.bhabin) * 1000) / 10)} dari seluruh Bhabin` : ''],
    ['Kehadiran', pct(s.kehadiranPersen), `${n(s.hadir)} absen masuk · ${n(s.terlambat)} terlambat`, s.kehadiranPersen != null && s.kehadiranPersen < 50 ? RED : undefined],
    ['Balita stunting belum ditangani', n(r.keluarga.belumDitangani), `${n(r.keluarga.stunting)} stunting · ${n(r.keluarga.berisiko)} berisiko`, r.keluarga.belumDitangani ? RED : undefined],
  ];
  const bw = (W - 16) / 3, bh = 52;
  ensure(2 * (bh + 8));
  const y0 = doc.y;
  kpis.forEach(([label, value, sub, color], i) => {
    const x = M + (i % 3) * (bw + 8), by = y0 + Math.floor(i / 3) * (bh + 8);
    doc.roundedRect(x, by, bw, bh, 6).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(t(label), x + 10, by + 7, { width: bw - 20 });
    doc.fillColor(color ?? INK).font('Helvetica-Bold').fontSize(16).text(t(value), x + 10, by + 18, { width: bw - 20 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(t(sub), x + 10, by + 38, { width: bw - 20, lineBreak: false, ellipsis: true });
  });
  doc.x = M;
  doc.y = y0 + 2 * (bh + 8);

  // ---------- Grafik laporan per hari ----------
  if (r.harian.length) {
    section('Laporan per hari', `Jumlah laporan terkirim per tanggal kegiatan · total ${n(s.laporan)}`, 95);
    const ch = 54, labelH = 10;
    ensure(ch + labelH + 16);
    const cy = doc.y + 4;
    const max = Math.max(1, ...r.harian.map((h) => h.jumlah));
    const slot = W / r.harian.length, barW = Math.max(2, Math.min(14, slot * 0.7));
    doc.moveTo(M, cy + ch).lineTo(M + W, cy + ch).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(6);
    r.harian.forEach((h, i) => {
      const x = M + i * slot + (slot - barW) / 2;
      const bhh = (h.jumlah / max) * (ch - 10);
      const weekend = [0, 6].includes(new Date(`${h.hari}T00:00:00Z`).getUTCDay());
      if (bhh > 0) doc.rect(x, cy + ch - bhh, barW, bhh).fill(weekend ? '#a5b4fc' : NAVY);
      if (h.jumlah === max && bhh > 0) doc.fillColor(INK).fontSize(6).text(String(h.jumlah), x - 6, cy + ch - bhh - 8, { width: barW + 12, align: 'center' });
      const day = Number(h.hari.slice(8));
      if (day === 1 || day % 5 === 0 || i === r.harian.length - 1) doc.fillColor(MUTED).fontSize(6).text(String(day), x - 6, cy + ch + 2, { width: barW + 12, align: 'center' });
    });
    doc.y = cy + ch + labelH;
    note('Batang muda = Sabtu/Minggu. Angka di atas batang = hari dengan laporan terbanyak.');
  }

  // ---------- Per kategori ----------
  const maxKat = Math.max(1, ...r.perKategori.map((c) => c.jumlah));
  section('Laporan per kategori', `Dibanding ${r.pembanding.label}`);
  tableOf([
    { title: 'Kategori', width: 34, get: (c) => c.label, bar: (c) => c.jumlah / maxKat },
    { title: 'Periode ini', width: 14, align: 'right', get: (c) => n(c.jumlah) },
    { title: 'Pembanding', width: 14, align: 'right', get: (c) => n(c.sebelumnya) },
    { title: 'Perubahan', width: 14, align: 'right', get: (c) => signed(change(c.jumlah, c.sebelumnya)),
      color: (c) => { const d = change(c.jumlah, c.sebelumnya); return d == null ? MUTED : d < 0 ? RED : GREEN; } },
    { title: 'Urgensi tinggi', width: 14, align: 'right', get: (c) => n(c.prioritas), color: (c) => (c.prioritas ? RED : undefined) },
  ], r.perKategori, { total: { label: 'Jumlah', jumlah: s.laporan, sebelumnya: s.laporanSebelumnya, prioritas: s.prioritas } });
  note(`Perubahan tidak dihitung (—) bila pembanding kurang dari ${MIN_BASE} laporan.`);

  // ---------- Keluarga & stunting (label–nilai) ----------
  const k = r.keluarga;
  const pairs: [string, string, boolean?][] = [
    ['Keluarga (KK) terdata', n(k.kk)], ['Balita', n(k.balita)],
    ['Balita stunting', n(k.stunting), !!k.stunting], ['Balita berisiko stunting', n(k.berisiko)],
    ['Stunting/berisiko belum ditangani', n(k.belumDitangani), !!k.belumDitangani], ['Ibu hamil', n(k.ibuHamil)],
    ['Ibu hamil KEK/anemia', n(k.ibuKek), !!k.ibuKek], ['KK jamban tidak layak', n(k.jambanTidakLayak)],
    ['KK air minum tidak layak', n(k.airTidakLayak)], ['KK dengan data sanitasi', n(k.kkSanitasi)],
  ];
  const ROW = 15;
  section('Keluarga & stunting', 'Dari laporan Mapping Data Keluarga periode ini; satu KK dihitung sekali. Tanpa data per orang.', Math.ceil(pairs.length / 2) * ROW + 40);
  const half = (W - 12) / 2;
  ensure(Math.ceil(pairs.length / 2) * ROW + 4);
  const ky0 = doc.y;
  pairs.forEach(([label, value, warn], i) => {
    const x = M + (i % 2) * (half + 12), ky = ky0 + Math.floor(i / 2) * ROW;
    if (Math.floor(i / 2) % 2) doc.rect(x, ky, half, ROW).fill(ZEBRA);
    doc.fillColor(INK).font('Helvetica').fontSize(7.5).text(t(label), x + 6, ky + 4, { width: half - 60 });
    doc.fillColor(warn ? RED : INK).font('Helvetica-Bold').text(t(value), x + half - 60, ky + 4, { width: 54, align: 'right' });
  });
  doc.y = ky0 + Math.ceil(pairs.length / 2) * ROW;
  doc.x = M;

  // ---------- Rekap per satuan ----------
  if (r.perSatuan.length) {
    const top = r.perSatuan.slice(0, 60);
    section('Rekap per satuan', `${r.perSatuan.length} satuan${r.perSatuan.length > top.length ? ` · ${top.length} teratas ditampilkan; lengkap di Excel` : ''}`);
    const tot = r.perSatuan.reduce((a, u) => ({ bhabin: a.bhabin + u.bhabin, bhabinAktif: a.bhabinAktif + u.bhabinAktif, laporan: a.laporan + u.laporan, prioritas: a.prioritas + u.prioritas, lokasiJanggal: a.lokasiJanggal + u.lokasiJanggal, terlambat: a.terlambat + u.terlambat }),
      { bhabin: 0, bhabinAktif: 0, laporan: 0, prioritas: 0, lokasiJanggal: 0, terlambat: 0 });
    tableOf([
      { title: 'Satuan', width: 34, get: (u) => u.nama },
      { title: 'Bhabin', width: 9, align: 'right', get: (u) => n(u.bhabin) },
      { title: 'Melapor', width: 9, align: 'right', get: (u) => n(u.bhabinAktif) },
      { title: 'Laporan', width: 10, align: 'right', get: (u) => n(u.laporan) },
      { title: 'Urgensi', width: 10, align: 'right', get: (u) => n(u.prioritas), color: (u) => (u.prioritas ? RED : undefined) },
      { title: 'Lokasi', width: 9, align: 'right', get: (u) => n(u.lokasiJanggal), color: (u) => (u.lokasiJanggal ? RED : undefined) },
      { title: 'Kehadiran', width: 10, align: 'right', get: (u) => pct(u.kehadiranPersen), color: (u) => (u.kehadiranPersen != null && u.kehadiranPersen < 50 ? RED : undefined) },
      { title: 'Terlambat', width: 10, align: 'right', get: (u) => n(u.terlambat) },
    ], top, { total: { nama: 'Jumlah', ...tot, kehadiranPersen: s.kehadiranPersen } });
    note('Merah: ada laporan urgensi tinggi / lokasi perlu dicek, atau kehadiran di bawah 50% hari kerja.');
  }

  // ---------- Bhabin perlu perhatian ----------
  const shown = perhatian.slice(0, 40);
  section('Bhabin perlu perhatian', `Tidak mengirim laporan atau kehadiran di bawah 50% hari kerja: ${n(perhatian.length)} orang${perhatian.length > shown.length ? ` · ${shown.length} ditampilkan; lengkap di Excel` : ''}`);
  if (shown.length) {
    tableOf([
      { title: 'NRP', width: 12, get: (b) => b.nrp },
      { title: 'Nama', width: 28, get: (b) => [b.pangkat, b.nama].filter(Boolean).join(' ') },
      { title: 'Satuan', width: 24, get: (b) => b.satuan },
      { title: 'Desa binaan', width: 20, get: (b) => b.desa ?? '—' },
      { title: 'Laporan', width: 9, align: 'right', get: (b) => n(b.laporan), color: (b) => (b.laporan ? undefined : RED) },
      { title: 'Hari hadir', width: 9, align: 'right', get: (b) => `${n(b.hadir)}/${r.hariKerja}`, color: (b) => (r.hariKerja && b.hadir / r.hariKerja < 0.5 ? RED : undefined) },
    ], shown);
    note('Merah: tidak ada laporan, atau hadir kurang dari setengah hari kerja.');
  } else note('Semua Bhabin melapor dan hadir minimal setengah hari kerja.');

  // ---------- Laporan urgensi tinggi ----------
  const pr = r.prioritas.slice(0, 25);
  section('Laporan deteksi dini urgensi tinggi', `${n(r.prioritas.length)} laporan${r.prioritas.length > pr.length ? ` · ${pr.length} terbaru ditampilkan` : ''}`, pr.length ? 80 : 30);
  if (pr.length) {
    tableOf([
      { title: 'Tanggal', width: 11, get: (p) => p.tanggal.toLocaleDateString('id-ID', { timeZone: r.unit.timezone, day: '2-digit', month: 'short' }) },
      { title: 'Nomor', width: 20, get: (p) => p.nomor },
      { title: 'Desa', width: 15, get: (p) => p.desa },
      { title: 'Bhabin', width: 18, get: (p) => p.bhabin },
      { title: 'Ringkasan', width: 40, get: (p) => p.ringkasan || '—' },
    ], pr);
  } else note('Tidak ada laporan deteksi dini urgensi tinggi pada periode ini.');

  // ---------- Harga pangan ----------
  section('Harga pangan', `Rata-rata laporan harga periode ini dibanding ${r.pembanding.label}`);
  tableOf([
    { title: 'Komoditas', width: 24, get: (h) => h.komoditas },
    { title: 'Satuan', width: 8, get: (h) => h.satuan },
    { title: 'Rata-rata', width: 14, align: 'right', get: (h) => rp(h.rata2) },
    { title: 'Pembanding', width: 14, align: 'right', get: (h) => rp(h.sebelumnya) },
    { title: 'Perubahan', width: 11, align: 'right', get: (h) => (h.perubahan == null ? '—' : `${h.perubahan > 0 ? '+' : ''}${pct(h.perubahan)}`),
      color: (h) => (h.perubahan == null ? undefined : h.perubahan >= 10 ? RED : h.perubahan <= -10 ? GREEN : undefined) },
    { title: 'Rentang', width: 22, align: 'right', get: (h) => (h.minimum == null ? '—' : `${rp(h.minimum)} – ${rp(h.maksimum)}`) },
    { title: 'Sampel', width: 8, align: 'right', get: (h) => n(h.sampel) },
  ], r.harga, { highlight: (h) => h.perubahan != null && h.perubahan >= 10 });
  note('Baris merah: harga naik 10% atau lebih. Hijau: turun 10% atau lebih.');

  // ---------- Pengesahan ----------
  if (doc.y > bottom() - 100) doc.addPage();
  const sx = M + W - 210, sy = doc.y + 18;
  doc.fillColor(INK).font('Helvetica').fontSize(8.5)
    .text(t(`Dikeluarkan pada tanggal ${tanggal(r.dibuat.toLocaleDateString('en-CA', { timeZone: r.unit.timezone }))}`), sx, sy, { width: 210, align: 'center' })
    .font('Helvetica-Bold').text(t(r.penandatangan.jabatan), sx, doc.y + 4, { width: 210, align: 'center' });
  const nameY = doc.y + 40;
  doc.font('Helvetica-Bold').fontSize(8.5).text(t(r.penandatangan.nama), sx, nameY, { width: 210, align: 'center', underline: true })
    .font('Helvetica').text(t(r.penandatangan.pangkatNrp), sx, doc.y + 1, { width: 210, align: 'center' });

  // ---------- Kaki halaman ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Menulis di area margin bawah memicu halaman baru di pdfkit: nolkan sementara.
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - M + 4;
    doc.moveTo(M, fy - 6).lineTo(M + W, fy - 6).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.fillColor(RED).font('Helvetica-Bold').fontSize(7).text(KLASIFIKASI, M, fy, { width: 60, lineBreak: false });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7)
      .text(t(`${r.nomor} · ${r.unit.nama} · dibuat ${r.dibuat.toLocaleString('id-ID', { timeZone: r.unit.timezone, dateStyle: 'short', timeStyle: 'short' })}`), M + 62, fy, { width: W - 122, height: 9, lineBreak: false, ellipsis: true })
      .text(`Hal. ${i + 1}/${range.count}`, M + W - 60, fy, { width: 60, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}
