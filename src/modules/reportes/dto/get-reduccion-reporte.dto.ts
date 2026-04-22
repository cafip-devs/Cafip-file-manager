import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';

export class GetReduccionReporteDto {
  @ApiProperty({
    description: 'ID del comprobante de reduccion',
    example: 1,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  comprobanteId: number;

  @ApiProperty({
    description: 'NIT de la institucion',
    example: '806013548',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'El nit solo debe contener digitos',
  })
  nit: string;

  @ApiProperty({
    description: 'DANE de la sede',
    example: '113052000431',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  daneSede: string;
}
