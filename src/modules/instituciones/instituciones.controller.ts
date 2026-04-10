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
import { InstitucionesService } from './instituciones.service';
import { UploadInstitutionImageDto } from './dto/upload-institution-image.dto';
import { InstitutionImageUploadResponseDto } from './dto/institution-image-upload-response.dto';

type MulterFile = Express.Multer.File;

const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const imageFileFilter = (
  _req: unknown,
  file: MulterFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Solo se permiten imágenes en formato PNG, JPG, JPEG o WEBP',
      ),
      false,
    );
  }
  callback(null, true);
};

@ApiTags('Instituciones')
@Controller('instituciones')
export class InstitucionesController {
  constructor(private readonly institucionesService: InstitucionesService) {}

  @Post('imagen')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subir imagen institucional a almacenamiento',
    description:
      'Sube una imagen institucional y retorna la URL pública asociada al NIT.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo', 'nit'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        nit: { type: 'string', example: '806013548' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen institucional subida exitosamente',
    type: InstitutionImageUploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadInstitutionImage(
    @UploadedFile() archivo: MulterFile,
    @Body() body: UploadInstitutionImageDto,
  ): Promise<InstitutionImageUploadResponseDto> {
    return this.institucionesService.uploadInstitutionImage(body, archivo);
  }
}

