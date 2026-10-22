import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/context/request-context';
import { HttpErrorFilter } from './common/filters/http-error.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Impor pengguna mengirim hingga 1.000 baris JSON.
  app.useBodyParser('json', { limit: '2mb' });
  // IP klien asli dari X-Forwarded-For hanya bila datang lewat proksi tepercaya (nginx/BFF Next.js di mesin yang sama).
  // Jangan percayai seluruh jaringan internal: klien di jaringan itu bisa memalsukan IP (audit & batas login).
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  app.use(requestContextMiddleware);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter());

  if (process.env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Lapor Bhabinkamtibmas API').setVersion('0.1').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  // HOST=127.0.0.1 di produksi agar API hanya terjangkau lewat reverse proxy, bukan langsung dari internet.
  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0');
}
bootstrap();
