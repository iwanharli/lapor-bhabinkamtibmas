/** Bangun ulang seluruh agregat analitik: npm run aggregates:rebuild */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AggregatesService } from '../src/modules/aggregates/aggregates.service';

async function main() {
  process.env.AGG_REFRESH_SECONDS = '0';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const pairs = await app.get(AggregatesService).rebuild();
  await app.get(AggregatesService).refresh();
  console.log(`Selesai: ${pairs} pasangan unit-hari.`);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
