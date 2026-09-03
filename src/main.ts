import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();
  app.useStaticAssets(path.join(__dirname, '..', 'public'));

  const swaggerEnabled =
    configService.get<string>('NODE_ENV') !== 'production' ||
    configService.get<string>('SWAGGER_ENABLED') === 'true';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Undangin Exhibitor API')
      .setDescription(
        'API backend untuk Undangin Exhibitor App. Semua endpoint (kecuali /auth/login dan ' +
          '/auth/refresh) butuh Bearer token dari hasil login. Login pakai event key 6-digit + nomor HP, tanpa OTP.',
      )
      .setVersion('0.1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token hasil dari POST /auth/login',
        },
        'access-token',
      )
      .addTag('Auth', 'Login via event key + nomor HP, refresh token')
      .addTag('Home', 'Home Dashboard - profil booth, lokasi, ringkasan lead & meeting')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Undangin Exhibitor API Docs',
    });
  }

  const port = configService.get<number>('PORT') ?? 4002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Undangin Exhibitor API listening on port ${port}`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`Swagger docs available at /api/docs`);
  }
}
bootstrap();
