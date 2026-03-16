import { ApiProperty } from '@nestjs/swagger';

export class FirmaUploadResponseDto {
  @ApiProperty({
    description: 'URL pública del archivo',
    example:
      'https://example.com/pdfs/Actas/Cafip/Presupuesto/cdp/123/documentos/firmas/aprobado/archivo.pdf',
  })
  url: string;

  @ApiProperty({
    description: 'Key/Path del archivo en el storage',
    example:
      'pdfs/Actas/Cafip/Presupuesto/cdp/123/documentos/firmas/aprobado/archivo.pdf',
  })
  key: string;
}
