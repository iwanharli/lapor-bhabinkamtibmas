/**
 * Pindahkan isian kesehatan Mapping Data Keluarga (status stunting, risiko ibu, dst.) yang masih tersimpan
 * sebagai data biasa ke bagian terenkripsi, dan isi kolom ringkasan `health`. Aman diulang.
 *
 *   npm run mapping:enkripsi-kesehatan
 */
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { SensitiveDataService } from '../src/common/crypto/sensitive-data.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { healthSummary } from '../src/modules/reports/health-summary';
import { FormSchemaJson, mergeSecret, mergeSensitive, splitSensitive } from '../src/modules/reports/report-validator';

const BATCH = 500;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const crypto = app.get(SensitiveDataService);
  const row = await prisma.formSchema.findUniqueOrThrow({ where: { category_version: { category: 'MAPPING_KK', version: 2 } } });
  const schema = row.schema as unknown as FormSchemaJson;

  let lastId = '00000000-0000-0000-0000-000000000000';
  let done = 0;
  for (;;) {
    const reports = await prisma.report.findMany({
      where: { category: 'MAPPING_KK', schemaVersion: 2, id: { gt: lastId } },
      orderBy: { id: 'asc' }, take: BATCH,
      select: { id: true, status: true, data: true, sensitive: true, occurredAt: true },
    });
    if (!reports.length) break;
    lastId = reports.at(-1)!.id;
    await prisma.$transaction(reports.map((r) => {
      const old = r.sensitive ? crypto.decrypt(Buffer.from(r.sensitive)) : {};
      const { plain, secret } = splitSensitive(schema, r.data as Record<string, unknown>);
      const merged = mergeSecret(old, secret);
      const full = mergeSensitive(plain, merged);
      return prisma.report.update({
        where: { id: r.id },
        data: {
          data: plain as Prisma.InputJsonObject,
          sensitive: Object.keys(merged).length ? Buffer.from(crypto.encrypt(merged)) : null,
          health: r.status === 'SUBMITTED' ? (healthSummary(full, r.occurredAt) as unknown as Prisma.InputJsonObject) : Prisma.DbNull,
        },
      });
    }));
    done += reports.length;
    process.stdout.write(`\r${done.toLocaleString('id-ID')} laporan`);
  }
  console.log(`\nSelesai: ${done.toLocaleString('id-ID')} laporan Mapping diproses.`);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
