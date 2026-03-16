import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';

type MulterFile = Express.Multer.File;
import { UploadFirmaDto } from './dto/upload-firma.dto';

interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class FirmasService {
  private readonly logger = new Logger(FirmasService.name);
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly client: S3Client;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_DOMAIN;

    if (
      !endpoint ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicUrl
    ) {
      this.logger.warn(
        'Variables de entorno para Cloudflare R2 incompletas. Revisa R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL (o R2_PUBLIC_DOMAIN).',
      );
    }

    this.bucket = bucket ?? '';
    this.publicUrl = publicUrl ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async uploadFirma(
    payload: UploadFirmaDto,
    file?: MulterFile,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo para subir.');
    }

    if (!this.bucket || !this.publicUrl) {
      throw new InternalServerErrorException(
        'La configuración de Cloudflare R2 no está completa.',
      );
    }

    const extension = this.ensureExtension(file.originalname);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const key = this.buildKey(payload, filename);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype ?? 'application/pdf',
      });

      await this.client.send(command);

      const url = this.buildPublicUrl(key);
      this.logger.log(`Archivo de firma subido correctamente: ${url}`);
      return { url, key };
    } catch (error) {
      this.logger.error(
        'Error subiendo archivo a Cloudflare R2',
        error as Error,
      );
      throw new InternalServerErrorException(
        'No se pudo subir el archivo de la firma.',
      );
    }
  }

  async deleteByUrl(url: string | null | undefined) {
    if (!url) {
      return;
    }
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      this.logger.warn(`No se pudo extraer la key desde la URL: ${url}`);
      return;
    }
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Archivo eliminado de Cloudflare R2: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error eliminando archivo de R2 (${key})`,
        error as Error,
      );
    }
  }

  private buildKey(payload: UploadFirmaDto, filename: string): string {
    const basePath = 'pdfs/Actas/Cafip/Presupuesto';
    const modulo = this.normalizeSegment(payload.modulo);
    const nit = this.normalizeNit(payload.nit);
    const tipo = payload.tipoFirma.toLowerCase();
    return `${basePath}/${modulo}/${nit}/documentos/firmas/${tipo}/${filename}`;
  }

  private normalizeNit(value: string) {
    const trimmed = value?.toString().trim();
    if (!trimmed) return 'sin-nit';
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private normalizeSegment(value: string) {
    return (
      value
        ?.toString()
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_') || 'sin-modulo'
    );
  }

  private ensureExtension(originalName: string) {
    const extension = extname(originalName || '').toLowerCase();
    return extension && extension !== '' ? extension : '.pdf';
  }

  private buildPublicUrl(key: string) {
    return `${this.publicUrl}/${key}`;
  }

  private extractKeyFromUrl(url: string) {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname.startsWith('/')
        ? parsedUrl.pathname.slice(1)
        : parsedUrl.pathname;
      return path;
    } catch (error) {
      this.logger.error(
        `Error extrayendo la key del archivo: ${url}`,
        error as Error,
      );
      return null;
    }
  }
}
