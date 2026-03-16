"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirmasController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const firmas_service_1 = require("./firmas.service");
const upload_firma_dto_1 = require("./dto/upload-firma.dto");
const firma_upload_response_dto_1 = require("./dto/firma-upload-response.dto");
const pdfFileFilter = (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
        return callback(new common_1.BadRequestException('Solo se permiten archivos en formato PDF'), false);
    }
    callback(null, true);
};
let FirmasController = class FirmasController {
    firmasService;
    constructor(firmasService) {
        this.firmasService = firmasService;
    }
    async uploadFirma(archivo, body) {
        const result = await this.firmasService.uploadFirma(body, archivo);
        return result;
    }
};
exports.FirmasController = FirmasController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Subir firma (PDF) a almacenamiento',
        description: 'Sube un archivo PDF de firma y retorna la URL pública.',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Archivo subido exitosamente',
        type: firma_upload_response_dto_1.FirmaUploadResponseDto,
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('archivo', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: pdfFileFilter,
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upload_firma_dto_1.UploadFirmaDto]),
    __metadata("design:returntype", Promise)
], FirmasController.prototype, "uploadFirma", null);
exports.FirmasController = FirmasController = __decorate([
    (0, swagger_1.ApiTags)('Firmas'),
    (0, common_1.Controller)('firmas'),
    __metadata("design:paramtypes", [firmas_service_1.FirmasService])
], FirmasController);
//# sourceMappingURL=firmas.controller.js.map