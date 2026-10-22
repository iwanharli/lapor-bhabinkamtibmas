/**
 * Kompres ulang foto lampiran yang sudah tersimpan (sebelum kompresi saat unggah diterapkan).
 *
 *   npm run storage:compress            # jalankan
 *   npm run storage:compress -- --cek   # hanya hitung perkiraan penghematan
 *
 * Aman diulang: foto yang sudah tidak bisa diperkecil dilewati. sha256 (file asli dari perangkat) tidak diubah.
 */
import { PrismaClient } from '@prisma/client';
import { readFile, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { compressPhoto, thumbnail } from '../src/common/storage/image';

const prisma = new PrismaClient();
const ROOT = resolve(process.env.STORAGE_LOCAL_DIR ?? './storage');
const dryRun = process.argv.includes('--cek');
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const rows = await prisma.attachment.findMany({
    where: { mime: { in: ['image/jpeg', 'image/png', 'image/webp'] } },
    select: { id: true, objectKey: true, thumbKey: true, mime: true, sizeBytes: true },
  });
  let before = 0;
  let after = 0;
  let changed = 0;
  let missing = 0;

  for (const a of rows) {
    const buf = await readFile(resolve(ROOT, a.objectKey)).catch(() => null);
    if (!buf) {
      missing++;
      continue;
    }
    const out = await compressPhoto(buf, a.mime).catch(() => null);
    before += buf.length;
    if (!out?.compressed) {
      after += buf.length;
      continue;
    }
    after += out.data.length;
    changed++;
    if (dryRun) continue;

    const key = a.objectKey.replace(/\.[^.]+$/, `.${out.ext}`);
    await writeFile(resolve(ROOT, key), out.data, { mode: 0o640 });
    if (key !== a.objectKey) await rm(resolve(ROOT, a.objectKey), { force: true });
    if (a.thumbKey) await writeFile(resolve(ROOT, a.thumbKey), await thumbnail(out.data), { mode: 0o640 });
    await prisma.attachment.update({ where: { id: a.id }, data: { objectKey: key, mime: out.mime, sizeBytes: out.data.length } });
  }

  console.log(`${dryRun ? '[cek] ' : ''}${changed} dari ${rows.length} foto dikompres: ${mb(before)} → ${mb(after)}` +
    (before ? ` (hemat ${Math.round((1 - after / before) * 100)}%)` : '') + (missing ? ` · ${missing} berkas tidak ditemukan` : ''));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
