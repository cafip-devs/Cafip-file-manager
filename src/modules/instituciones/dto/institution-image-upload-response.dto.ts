import { ApiProperty } from '@nestjs/swagger';

export class InstitutionImageUploadResponseDto {
  @ApiProperty({
    example:
      'https://cdn.example.com/imagenes/instituciones/806013548/1712780000000-uuid.webp',
  })
  url: string;

  @ApiProperty({
    example: 'imagenes/instituciones/806013548/1712780000000-uuid.webp',
  })
  key: string;
}

