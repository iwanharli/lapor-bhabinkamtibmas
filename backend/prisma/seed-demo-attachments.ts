/**
 * Lampiran contoh (gambar sintetis bertanda air) untuk laporan demo — JANGAN dijalankan di produksi.
 *   npm run seed:demo-attachments            # lewati bila sudah ada lampiran
 *   npm run seed:demo-attachments -- --reset
 *   npm run seed:demo-attachments -- --reset --semua   # termasuk laporan contoh nasional (DEMO-*)
 */
import { AttachmentSource, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import sharp from 'sharp';

const prisma = new PrismaClient();
const ROOT = resolve(process.env.STORAGE_LOCAL_DIR ?? './storage');

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

const PHOTO_FIELD: Record<string, string> = {
  SAMBANG: 'foto_bersama', DETEKSI_DINI: 'foto_lapangan', PROBLEM_SOLVING: 'foto_kegiatan', PENYULUHAN: 'foto_stiker',
  HARGA_PANGAN: 'foto_etalase', MAPPING_KK: 'foto_hunian', KETAHANAN_PANGAN: 'foto_lahan',
};
const SCENE: Record<string, [string, string, string]> = {
  SAMBANG: ['#6b4423', '#c9a227', 'Kunjungan warga'], DETEKSI_DINI: ['#7f1d1d', '#f59e0b', 'Kondisi lapangan'],
  PROBLEM_SOLVING: ['#3f3f46', '#a1a1aa', 'Mediasi di balai desa'], PENYULUHAN: ['#4c1d95', '#c084fc', 'Penyuluhan warga'],
  HARGA_PANGAN: ['#0c4a6e', '#38bdf8', 'Etalase kios'], MAPPING_KK: ['#365314', '#a3e635', 'Hunian warga'],
  KETAHANAN_PANGAN: ['#14532d', '#4ade80', 'Lahan pangan'],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svg(category: string, nomor: string, when: Date, lat: number, lng: number, n: number) {
  const [a, b, label] = SCENE[category] ?? SCENE.SAMBANG;
  const hills = Array.from({ length: 4 }, (_, i) => {
    const y = 520 + i * 60 + rnd() * 40;
    return `<path d="M0 ${y} Q 300 ${y - 120 - rnd() * 80} 600 ${y} T 1200 ${y} V 900 H 0 Z" fill="${b}" opacity="${0.18 + i * 0.12}"/>`;
  }).join('');
  const ts = when.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>${hills}
  <circle cx="${900 + rnd() * 150}" cy="${170 + rnd() * 60}" r="70" fill="#fff" opacity="0.25"/>
  <text x="60" y="120" font-family="Helvetica, Arial" font-size="64" font-weight="700" fill="#fff">${esc(label)}</text>
  <text x="60" y="180" font-family="Helvetica, Arial" font-size="32" fill="#fff" opacity="0.85">Foto contoh #${n} · ${esc(nomor)}</text>
  <rect x="0" y="780" width="1200" height="120" fill="#000" opacity="0.45"/>
  <text x="40" y="830" font-family="Menlo, monospace" font-size="30" fill="#fff">${esc(ts)} WIB</text>
  <text x="40" y="872" font-family="Menlo, monospace" font-size="26" fill="#fff" opacity="0.85">${lat.toFixed(6)}, ${lng.toFixed(6)} · DEMO</text>
</svg>`;
}

async function put(key: string, data: Buffer) {
  const p = join(ROOT, key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo tidak boleh dijalankan di produksi');
  if (process.argv.includes('--reset')) {
    await prisma.attachment.deleteMany({ where: { reportId: { not: null } } });
    await rm(join(ROOT, 'demo'), { recursive: true, force: true });
  } else if (await prisma.attachment.count()) {
    console.log('Lampiran sudah ada, dilewati (gunakan --reset).');
    return;
  }

  // Bawaan hanya laporan Polres Contoh; laporan contoh nasional (unit DEMO-*) terlalu banyak untuk dibuatkan foto.
  // `--semua`: semua laporan (untuk data demo yang kecil, mis. satu provinsi).
  const reports = await prisma.report.findMany({
    where: process.argv.includes('--semua') ? {} : { unit: { kode: { not: { startsWith: 'DEMO-' } } } },
    select: { id: true, nomor: true, category: true, occurredAt: true, lat: true, lng: true },
  });
  let total = 0;
  for (const r of reports) {
    if (rnd() < 0.15) continue; // sebagian laporan tanpa lampiran
    const count = 1 + Math.floor(rnd() * 3);
    for (let n = 1; n <= count; n++) {
      const jpg = await sharp(Buffer.from(svg(r.category, r.nomor ?? '', r.occurredAt, r.lat, r.lng, n))).jpeg({ quality: 78 }).toBuffer();
      const thumb = await sharp(jpg).resize(480, 480, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();
      const id = randomUUID();
      const base = `demo/${r.id}/${id}`;
      await put(`${base}.jpg`, jpg);
      await put(`${base}.thumb.webp`, thumb);
      await prisma.attachment.create({
        data: {
          reportId: r.id, fieldKey: PHOTO_FIELD[r.category] ?? 'foto', clientUuid: id, objectKey: `${base}.jpg`, thumbKey: `${base}.thumb.webp`,
          mime: 'image/jpeg', sizeBytes: jpg.length, sha256: createHash('sha256').update(jpg).digest('hex'),
          source: AttachmentSource.CAMERA, capturedAt: r.occurredAt, watermarked: true,
        },
      });
      total++;
    }
  }
  console.log(`${total} lampiran contoh dibuat di ${ROOT}/demo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
