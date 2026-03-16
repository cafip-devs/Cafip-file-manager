type MulterFile = Express.Multer.File;
import { UploadFirmaDto } from './dto/upload-firma.dto';
interface UploadResult {
    url: string;
    key: string;
}
export declare class FirmasService {
    private readonly logger;
    private readonly bucket;
    private readonly publicUrl;
    private readonly client;
    constructor();
    uploadFirma(payload: UploadFirmaDto, file?: MulterFile): Promise<UploadResult>;
    deleteByUrl(url: string | null | undefined): Promise<void>;
    private buildKey;
    private normalizeNit;
    private normalizeSegment;
    private ensureExtension;
    private buildPublicUrl;
    private extractKeyFromUrl;
}
export {};
