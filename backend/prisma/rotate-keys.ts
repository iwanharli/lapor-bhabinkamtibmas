/**
 * Rotasi kunci enkripsi: enkripsi ulang salinan token integrasi dengan kunci AKTIF (entri pertama DATA_ENCRYPTION_KEYS).
 * Isian laporan tidak lagi dienkripsi (lihat prisma/decrypt-reports.ts). Setelah selesai, kunci lama boleh dihapus dari env.
 *
 *   1. DATA_ENCRYPTION_KEYS="k2:<kunci-baru>,k1:<kunci-lama>"  lalu restart layanan (data baru memakai k2)
 *   2. npm run crypto:rotasi                                     (aman diulang; bisa dihentikan & dilanjutkan)
 *   3. hapus k1 dari env, restart; simpan arsip k1 terpisah selama backup lama masih disimpan
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SensitiveDataService } from '../src/common/crypto/sensitive-data.service';
import { PrismaService } from '../src/prisma/prisma.service';


async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const crypto = app.get(SensitiveDataService);
  const active = crypto.activeKeyId();

  // Token integrasi tersimpan terenkripsi (untuk disalin ulang di halaman admin).
  const tokens = await prisma.integrationToken.findMany({ where: { tokenEnc: { not: null } }, select: { id: true, tokenEnc: true } });
  const staleTokens = tokens.filter((t) => crypto.keyIdOf(Buffer.from(t.tokenEnc!)) !== active);
  await prisma.$transaction(staleTokens.map((t) => prisma.integrationToken.update({
    where: { id: t.id }, data: { tokenEnc: Buffer.from(crypto.encrypt(crypto.decrypt(Buffer.from(t.tokenEnc!)))) },
  })));
  console.log(`\n${staleTokens.length} token integrasi dienkripsi ulang.`);
  console.log(`Selesai. Token integrasi memakai kunci "${active}".`);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
