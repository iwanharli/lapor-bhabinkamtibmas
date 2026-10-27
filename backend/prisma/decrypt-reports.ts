/**
 * Migrasi sekali jalan: hapus enkripsi isian laporan. Isian terenkripsi (kolom `sensitive`) dibuka dan digabung ke `data`,
 * kolom `sensitive` dikosongkan, dan sidik No. KK (`kk_hash`) dihitung ulang sebagai SHA-256 biasa tanpa kunci.
 * Aman diulang dan bisa dihentikan/dilanjutkan. Wajib dijalankan SEBELUM rilis tanpa enkripsi diaktifkan
 * (rilis baru tidak lagi membaca kolom `sensitive`). Butuh DATA_ENCRYPTION_KEYS yang masih memuat kunci lama.
 *
 *   npm run laporan:buka-enkripsi              # jalankan
 *   npm run laporan:buka-enkripsi -- --cek     # hanya hitung, tanpa mengubah
 */
import { createHash } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { SensitiveDataService } from '../src/common/crypto/sensitive-data.service';
import { PrismaService } from '../src/prisma/prisma.service';

const BATCH = 200;
const DRY = process.argv.includes('--cek');
type Row = Record<string, unknown>;

/** Baris repeater rahasia dicocokkan lewat _id; data lama tanpa _id dicocokkan menurut urutan. */
function merge(plain: Row, secret: Row): Row {
  const out: Row = { ...plain };
  for (const [k, v] of Object.entries(secret)) {
    if (Array.isArray(v) && Array.isArray(plain[k])) {
      const rows = v as Row[];
      const byId = new Map(rows.filter((r) => r?._id).map((r) => [r._id, r]));
      const legacy = rows.every((r) => !r?._id);
      out[k] = (plain[k] as Row[]).map((row, i) => ({ ...row, ...((row?._id && byId.get(row._id)) || (legacy ? rows[i] : undefined) || {}) }));
    } else out[k] = v;
  }
  return out;
}

export const kkHash = (noKk: unknown) => (typeof noKk === 'string' && noKk.trim() ? createHash('sha256').update(noKk.trim()).digest('hex') : null);

async function main() {
  process.env.AGG_REFRESH_SECONDS = '0';
  process.env.EXPORT_POLL_MS = '0';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const crypto = app.get(SensitiveDataService);

  let lastId = '00000000-0000-0000-0000-000000000000';
  let opened = 0, failed = 0;
  for (;;) {
    const rows = await prisma.report.findMany({
      where: { sensitive: { not: null }, id: { gt: lastId } }, orderBy: { id: 'asc' }, take: BATCH,
      select: { id: true, category: true, data: true, sensitive: true },
    });
    if (!rows.length) break;
    lastId = rows.at(-1)!.id;
    for (const r of rows) {
      try {
        const data = merge((r.data ?? {}) as Row, crypto.decrypt(Buffer.from(r.sensitive!)));
        if (!DRY) {
          await prisma.report.update({
            where: { id: r.id },
            data: { data: data as Prisma.InputJsonObject, sensitive: null, ...(r.category === 'MAPPING_KK' && { kkHash: kkHash(data.no_kk) }) },
          });
        }
        opened++;
      } catch (e) {
        failed++;
        console.error(`Laporan ${r.id} gagal dibuka: ${(e as Error).message}`);
      }
    }
  }

  // Sidik No. KK untuk Mapping KK yang memang tidak punya isian terenkripsi (No. KK sudah di data): samakan formatnya.
  let rehashed = 0;
  const kk = await prisma.report.findMany({ where: { category: 'MAPPING_KK', sensitive: null }, select: { id: true, data: true, kkHash: true } });
  for (const r of kk) {
    const h = kkHash((r.data as Row | null)?.no_kk);
    if (h === r.kkHash) continue;
    if (!DRY) await prisma.report.update({ where: { id: r.id }, data: { kkHash: h } });
    rehashed++;
  }

  console.log(`${DRY ? '[cek] ' : ''}${opened} laporan dibuka dari enkripsi, ${failed} gagal, ${rehashed} sidik No. KK dihitung ulang.`);
  await app.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
