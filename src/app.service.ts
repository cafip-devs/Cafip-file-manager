import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'FileManager API - Subida de archivos y generación de informes';
  }
}
