import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { FirmaModulo } from '../enums/firma-modulo.enum';
import { TipoFirma } from '../enums/tipo-firma.enum';

export class UploadFirmaDto {
  @ApiProperty({
    description: 'Módulo asociado a la firma',
    enum: FirmaModulo,
    example: FirmaModulo.CDP,
  })
  @IsEnum(FirmaModulo)
  modulo: FirmaModulo;

  @ApiProperty({
    description: 'Tipo de firma',
    enum: TipoFirma,
    example: TipoFirma.APROBADO,
  })
  @IsEnum(TipoFirma)
  tipoFirma: TipoFirma;

  @ApiProperty({
    description: 'NIT de la institución',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  nit: string;
}
