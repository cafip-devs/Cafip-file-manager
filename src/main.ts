import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Iniciando FileManager (NestJS)...');
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      logger,
    });

    const port = Number(process.env.PORT ?? 3005);

    const baseUrl =
      process.env.API_BASE_URL ||
      process.env.APP_BASE_URL ||
      `http://localhost:${port}`;

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    const config = new DocumentBuilder()
      .setTitle('FileManager API')
      .setDescription(
        'Microservicio de subida de archivos (firmas) y generación de reportes',
      )
      .setVersion('1.0')
      .addServer(baseUrl)
      .build();

    const document = SwaggerModule.createDocument(app, config);

    app.use(
      '/docs',
      apiReference({
        content: document,
      } as Parameters<typeof apiReference>[0]),
    );

    app.enableCors({
      origin: [
        'http://localhost:4200',
        'http://localhost:3000',
        'http://localhost:3001',
        baseUrl.replace(/\/$/, ''),
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    await app.listen(port);

    logger.log('\n🚀 FileManager iniciado correctamente!\n');
    logger.log(`📡 API: ${baseUrl}`);
    logger.log(`📚 Documentación Scalar: ${baseUrl}/docs\n`);
  } catch (error) {
    logger.error('❌ Error durante el bootstrap:', error);
    process.exit(1);
  }
}
bootstrap();
