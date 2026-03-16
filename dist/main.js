"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const nestjs_api_reference_1 = require("@scalar/nestjs-api-reference");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    try {
        logger.log('🚀 Iniciando FileManager (NestJS)...');
        const app = await core_1.NestFactory.create(app_module_1.AppModule, {
            bufferLogs: true,
            logger,
        });
        const port = Number(process.env.PORT ?? 3001);
        const baseUrl = process.env.API_BASE_URL ||
            process.env.APP_BASE_URL ||
            `http://localhost:${port}`;
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }));
        const config = new swagger_1.DocumentBuilder()
            .setTitle('FileManager API')
            .setDescription('Microservicio de subida de archivos (firmas) y generación de informes')
            .setVersion('1.0')
            .addServer(baseUrl)
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        app.use('/docs', (0, nestjs_api_reference_1.apiReference)({
            content: document,
        }));
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
    }
    catch (error) {
        logger.error('❌ Error durante el bootstrap:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map