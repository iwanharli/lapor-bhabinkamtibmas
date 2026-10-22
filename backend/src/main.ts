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
  // BFF Next.js & reverse proxy internal: ambil IP klien asli dari X-Forwarded-For.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
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

  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
