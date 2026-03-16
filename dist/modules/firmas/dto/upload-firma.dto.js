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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFirmaDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const firma_modulo_enum_1 = require("../enums/firma-modulo.enum");
const tipo_firma_enum_1 = require("../enums/tipo-firma.enum");
class UploadFirmaDto {
    modulo;
    tipoFirma;
    nit;
}
exports.UploadFirmaDto = UploadFirmaDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Módulo asociado a la firma',
        enum: firma_modulo_enum_1.FirmaModulo,
        example: firma_modulo_enum_1.FirmaModulo.CDP,
    }),
    (0, class_validator_1.IsEnum)(firma_modulo_enum_1.FirmaModulo),
    __metadata("design:type", String)
], UploadFirmaDto.prototype, "modulo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipo de firma',
        enum: tipo_firma_enum_1.TipoFirma,
        example: tipo_firma_enum_1.TipoFirma.APROBADO,
    }),
    (0, class_validator_1.IsEnum)(tipo_firma_enum_1.TipoFirma),
    __metadata("design:type", String)
], UploadFirmaDto.prototype, "tipoFirma", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'NIT de la institución',
        example: '123456789',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UploadFirmaDto.prototype, "nit", void 0);
//# sourceMappingURL=upload-firma.dto.js.map