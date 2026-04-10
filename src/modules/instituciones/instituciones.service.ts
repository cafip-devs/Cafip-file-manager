import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';
import { UploadInstitutionImageDto } from './dto/upload-institution-image.dto';

type MulterFile = Express.Multer.File;

interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class InstitucionesService {
  private readonly logger = new Logger(InstitucionesService.name);
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly client: S3Client;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL ?? process.env.R2_PUBLIC_DOMAIN;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
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

  async uploadInstitutionImage(
    payload: UploadInstitutionImageDto,
    file?: MulterFile,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No se recibió ninguna imagen para subir.');
    }

    if (!this.bucket || !this.publicUrl) {
      throw new InternalServerErrorException(
        'La configuración de Cloudflare R2 no está completa.',
      );
    }

    const extension = this.ensureExtension(file.originalname);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const key = this.buildKey(payload.nit, filename);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype ?? 'image/webp',
        }),
      );

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Imagen institucional subida correctamente: ${url}`);
      return { url, key };
    } catch (error) {
      this.logger.error(
        'Error subiendo imagen institucional a Cloudflare R2',
        error as Error,
      );
      throw new InternalServerErrorException(
        'No se pudo subir la imagen institucional.',
      );
    }
  }

  private buildKey(nit: string, filename: string): string {
    return `imagenes/instituciones/${this.normalizeNit(nit)}/${filename}`;
  }

  private normalizeNit(value: string): string {
    const trimmed = value?.toString().trim();
    if (!trimmed) return 'sin-nit';
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private ensureExtension(originalName: string): string {
    const extension = extname(originalName || '').toLowerCase();
    return extension && extension !== '' ? extension : '.webp';
  }
}

