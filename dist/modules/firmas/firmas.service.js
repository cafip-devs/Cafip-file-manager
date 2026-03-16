"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FirmasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirmasService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const path_1 = require("path");
let FirmasService = FirmasService_1 = class FirmasService {
    logger = new common_1.Logger(FirmasService_1.name);
    bucket;
    publicUrl;
    client;
    constructor() {
        const endpoint = process.env.R2_ENDPOINT;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const bucket = process.env.R2_BUCKET;
        const publicUrl = process.env.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_DOMAIN;
        if (!endpoint ||
            !accessKeyId ||
            !secretAccessKey ||
            !bucket ||
            !publicUrl) {
            this.logger.warn('Variables de entorno para Cloudflare R2 incompletas. Revisa R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL (o R2_PUBLIC_DOMAIN).');
        }
        this.bucket = bucket ?? '';
        this.publicUrl = publicUrl ?? '';
        this.client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint,
            forcePathStyle: true,
            ...(accessKeyId && secretAccessKey
                ? { credentials: { accessKeyId, secretAccessKey } }
                : {}),
        });
    }
    async uploadFirma(payload, file) {
        if (!file) {
            throw new common_1.BadRequestException('No se recibió ningún archivo para subir.');
        }
        if (!this.bucket || !this.publicUrl) {
            throw new common_1.InternalServerErrorException('La configuración de Cloudflare R2 no está completa.');
        }
        const extension = this.ensureExtension(file.originalname);
        const filename = `${Date.now()}-${(0, crypto_1.randomUUID)()}${extension}`;
        const key = this.buildKey(payload, filename);
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype ?? 'application/pdf',
            });
            await this.client.send(command);
            const url = this.buildPublicUrl(key);
            this.logger.log(`Archivo de firma subido correctamente: ${url}`);
            return { url, key };
        }
        catch (error) {
            this.logger.error('Error subiendo archivo a Cloudflare R2', error);
            throw new common_1.InternalServerErrorException('No se pudo subir el archivo de la firma.');
        }
    }
    async deleteByUrl(url) {
        if (!url) {
            return;
        }
        const key = this.extractKeyFromUrl(url);
        if (!key) {
            this.logger.warn(`No se pudo extraer la key desde la URL: ${url}`);
            return;
        }
        try {
            await this.client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucket,
                Key: key,
            }));
            this.logger.log(`Archivo eliminado de Cloudflare R2: ${key}`);
        }
        catch (error) {
            this.logger.error(`Error eliminando archivo de R2 (${key})`, error);
        }
    }
    buildKey(payload, filename) {
        const basePath = 'pdfs/Actas/Cafip/Presupuesto';
        const modulo = this.normalizeSegment(payload.modulo);
        const nit = this.normalizeNit(payload.nit);
        const tipo = payload.tipoFirma.toLowerCase();
        return `${basePath}/${modulo}/${nit}/documentos/firmas/${tipo}/${filename}`;
    }
    normalizeNit(value) {
        const trimmed = value?.toString().trim();
        if (!trimmed)
            return 'sin-nit';
        return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    normalizeSegment(value) {
        return (value
            ?.toString()
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_') || 'sin-modulo');
    }
    ensureExtension(originalName) {
        const extension = (0, path_1.extname)(originalName || '').toLowerCase();
        return extension && extension !== '' ? extension : '.pdf';
    }
    buildPublicUrl(key) {
        return `${this.publicUrl}/${key}`;
    }
    extractKeyFromUrl(url) {
        try {
            const parsedUrl = new URL(url);
            const path = parsedUrl.pathname.startsWith('/')
                ? parsedUrl.pathname.slice(1)
                : parsedUrl.pathname;
            return path;
        }
        catch (error) {
            this.logger.error(`Error extrayendo la key del archivo: ${url}`, error);
            return null;
        }
    }
};
exports.FirmasService = FirmasService;
exports.FirmasService = FirmasService = FirmasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FirmasService);
//# sourceMappingURL=firmas.service.js.map