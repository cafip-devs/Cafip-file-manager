import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { FirmasService } from './firmas.service';
import { UploadFirmaDto } from './dto/upload-firma.dto';
import { FirmaUploadResponseDto } from './dto/firma-upload-response.dto';

type MulterFile = Express.Multer.File;

const pdfFileFilter = (
  _req: unknown,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (file.mimetype !== 'application/pdf') {
    return callback(
      new BadRequestException('Solo se permiten archivos en formato PDF'),
      false,
    );
  }
  callback(null, true);
};

@ApiTags('Firmas')
@Controller('firmas')
export class FirmasController {
  constructor(private readonly firmasService: FirmasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subir firma (PDF) a almacenamiento',
    description: 'Sube un archivo PDF de firma y retorna la URL pública.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'modulo', 'tipoFirma', 'nit'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        modulo: { type: 'string', example: 'cdp' },
        tipoFirma: { type: 'string', example: 'APROBADO' },
        nit: { type: 'string', example: '123456789' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo subido exitosamente',
    type: FirmaUploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: pdfFileFilter,
    }),
  )
  async uploadFirma(
    @UploadedFile() archivo: MulterFile,
    @Body() body: UploadFirmaDto,
  ): Promise<FirmaUploadResponseDto> {
    const result = await this.firmasService.uploadFirma(body, archivo);
    return result;
  }
}
