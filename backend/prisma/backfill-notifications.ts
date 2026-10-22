/**
 * Isi notifikasi dari laporan yang sudah ada (prioritas / lokasi perlu dicek), memakai logika yang sama dengan saat kirim.
 * Aman diulang (satu notifikasi per jenis per laporan per penerima).
 *   npm run notifications:isi              # laporan 7 hari terakhir
 *   npm run notifications:isi -- --hari=30
 */
process.env.AGG_REFRESH_SECONDS = '0';
process.env.EXPORT_POLL_MS = '0';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DAYS = Number(process.argv.find((a) => a.startsWith('--hari='))?.split('=')[1] ?? 7);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const notifications = app.get(NotificationsService);
  const ids = (await prisma.$queryRaw<{ id: string }[]>`
    SELECT id::text FROM reports
    WHERE status = 'SUBMITTED' AND submitted_at > now() - make_interval(days => ${DAYS}::int)
      AND (priority OR is_mock_location OR inside_village = false)`).map((r) => r.id);
  let created = 0;
  for (let i = 0; i < ids.length; i += 5000) created += await notifications.onReportsSubmitted(ids.slice(i, i + 5000));
  console.log(`${created.toLocaleString('id-ID')} notifikasi dibuat dari ${ids.length.toLocaleString('id-ID')} laporan (${DAYS} hari).`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
