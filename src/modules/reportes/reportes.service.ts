import { Injectable } from '@nestjs/common';
import { GetCdpReporteDto } from './dto/get-cdp-reporte.dto';
import { GetCrpReporteDto } from './dto/get-crp-reporte.dto';
import { GetLiquidacionPresupuestalReporteDto } from './dto/get-liquidacion-presupuestal-reporte.dto';
import { ReportesRepository } from './reportes.repository';
import { numeroAPesosEnLetras } from './utils/numero-a-letras.util';

@Injectable()
export class ReportesService {
  constructor(private readonly reportesRepository: ReportesRepository) {}

  async getLiquidacionPresupuestalReporte(
    filters: GetLiquidacionPresupuestalReporteDto,
  ): Promise<Record<string, unknown>> {
    return this.reportesRepository.getLiquidacionPresupuestalReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );
  }

  async getCdpReporte(
    filters: GetCdpReporteDto,
  ): Promise<Record<string, unknown>> {
    const reporte = await this.reportesRepository.getCdpReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );

    const cabecera = reporte.cabecera as Record<string, unknown> | undefined;
    const totalCdpObjeto = cabecera?.totalCdpObjeto;

    if (cabecera) {
      cabecera.valorEnLetras = numeroAPesosEnLetras(totalCdpObjeto as
        | number
        | string
        | null
        | undefined);
    }

    return reporte;
  }

  async getCrpReporte(
    filters: GetCrpReporteDto,
  ): Promise<Record<string, unknown>> {
    const reporte = await this.reportesRepository.getCrpReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );

    const cabecera = reporte.cabecera as Record<string, unknown> | undefined;
    const totalCrp = cabecera?.totalCrp;

    if (cabecera) {
      cabecera.valorEnLetras = numeroAPesosEnLetras(totalCrp as
        | number
        | string
        | null
        | undefined);
    }

    return reporte;
  }
}
