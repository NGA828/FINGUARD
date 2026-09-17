import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getConnection } from './database/connection';

async function bootstrap() {
  // Initialise la base de données (création du schéma si nécessaire).
  getConnection();

  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  // Documentation OpenAPI automatique — consultable sur /api/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shield API')
    .setDescription(
      'API du Système Intelligent de Gestion des Transactions Bancaires et de Détection de Fraude. ' +
        'Trois espaces protégés par JWT + RBAC : `/api/customer/*` (CLIENT), `/api/employee/*` (EMPLOYEE), `/api/admin/*` (ADMIN).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Shield — Documentation API',
  });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🛡️  Shield API démarrée sur http://localhost:${port}/api`);
}

bootstrap();
