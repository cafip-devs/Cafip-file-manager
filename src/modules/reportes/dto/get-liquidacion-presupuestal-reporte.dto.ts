import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';

export class GetLiquidacionPresupuestalReporteDto {
  @ApiProperty({
    description: 'ID del comprobante de liquidacion presupuestal',
    example: 45,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  comprobanteId: number;

  @ApiProperty({
    description: 'NIT de la institucion',
    example: '123456789',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, {
    message: 'El nit solo debe contener digitos',
  })
  nit: string;

  @ApiProperty({
    description: 'DANE de la sede (dane_pri de catalogo privada)',
    example: '123456789012',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  daneSede: string;
}
