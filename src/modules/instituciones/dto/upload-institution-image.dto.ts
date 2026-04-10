import { IsNotEmpty, IsString } from 'class-validator';

export class UploadInstitutionImageDto {
  @IsString()
  @IsNotEmpty()
  nit: string;
}

