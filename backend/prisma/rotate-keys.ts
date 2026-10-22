/**
 * Rotasi kunci enkripsi: enkripsi ulang semua data sensitif laporan dengan kunci AKTIF (entri pertama
 * DATA_ENCRYPTION_KEYS) dan hitung ulang sidik No. KK. Setelah selesai, kunci lama boleh dihapus dari env.
 *
 *   1. DATA_ENCRYPTION_KEYS="k2:<kunci-baru>,k1:<kunci-lama>"  lalu restart layanan (data baru memakai k2)
 *   2. npm run crypto:rotasi                                     (aman diulang; bisa dihentikan & dilanjutkan)
 *   3. hapus k1 dari env, restart; simpan arsip k1 terpisah selama backup lama masih disimpan
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SensitiveDataService } from '../src/common/crypto/sensitive-data.service';
import { PrismaService } from '../src/prisma/prisma.service';

const BATCH = 500;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const crypto = app.get(SensitiveDataService);
  const active = crypto.activeKeyId();

  let lastId = '00000000-0000-0000-0000-000000000000';
  let rotated = 0, skipped = 0;
  for (;;) {
    const rows = await prisma.report.findMany({
      where: { sensitive: { not: null }, id: { gt: lastId } }, orderBy: { id: 'asc' }, take: BATCH,
      select: { id: true, category: true, sensitive: true },
    });
    if (!rows.length) break;
    lastId = rows.at(-1)!.id;
    const todo = rows.filter((r) => crypto.keyIdOf(Buffer.from(r.sensitive!)) !== active);
    skipped += rows.length - todo.length;
    await prisma.$transaction(todo.map((r) => {
      const secret = crypto.decrypt(Buffer.from(r.sensitive!));
      const noKk = r.category === 'MAPPING_KK' && typeof secret.no_kk === 'string' ? secret.no_kk : null;
      return prisma.report.update({
        where: { id: r.id },
        data: { sensitive: Buffer.from(crypto.encrypt(secret)), ...(r.category === 'MAPPING_KK' && { kkHash: noKk ? crypto.blindIndex('no_kk', noKk) : null }) },
      });
    }));
    rotated += todo.length;
    process.stdout.write(`\r${rotated.toLocaleString('id-ID')} dienkripsi ulang, ${skipped.toLocaleString('id-ID')} sudah memakai kunci ${active}`);
  }
  console.log(`\nSelesai. Semua data sensitif laporan memakai kunci "${active}".`);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
