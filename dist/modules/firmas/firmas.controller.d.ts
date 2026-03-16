import { FirmasService } from './firmas.service';
import { UploadFirmaDto } from './dto/upload-firma.dto';
import { FirmaUploadResponseDto } from './dto/firma-upload-response.dto';
type MulterFile = Express.Multer.File;
export declare class FirmasController {
    private readonly firmasService;
    constructor(firmasService: FirmasService);
    uploadFirma(archivo: MulterFile, body: UploadFirmaDto): Promise<FirmaUploadResponseDto>;
}
export {};
