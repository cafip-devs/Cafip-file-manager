import { Injectable } from '@nestjs/common';
import { GetAdicionReporteDto } from './dto/get-adicion-reporte.dto';
import { GetCdpReporteDto } from './dto/get-cdp-reporte.dto';
import { GetCrpReporteDto } from './dto/get-crp-reporte.dto';
import { GetLiquidacionPresupuestalReporteDto } from './dto/get-liquidacion-presupuestal-reporte.dto';
import { GetReduccionReporteDto } from './dto/get-reduccion-reporte.dto';
import { ReportesRepository } from './reportes.repository';
import { formatearFechasReporte } from './utils/formato-fecha.util';
import { numeroAPesosEnLetras } from './utils/numero-a-letras.util';

@Injectable()
export class ReportesService {
  constructor(private readonly reportesRepository: ReportesRepository) {}

  async getAdicionReporte(
    filters: GetAdicionReporteDto,
  ): Promise<Record<string, unknown>> {
    const reporte = await this.reportesRepository.getAdicionReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );

    const cabecera = reporte.cabecera as Record<string, unknown> | undefined;
    const totalAdicion = cabecera?.totalAdicion;

    if (cabecera) {
      cabecera.valorEnLetras = numeroAPesosEnLetras(
        totalAdicion as number | string | null | undefined,
      ).toUpperCase();
    }

    return formatearFechasReporte(reporte);
  }

  async getLiquidacionPresupuestalReporte(
    filters: GetLiquidacionPresupuestalReporteDto,
  ): Promise<Record<string, unknown>> {
    const reporte = await this.reportesRepository.getLiquidacionPresupuestalReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );

    return formatearFechasReporte(reporte);
  }

  async getReduccionReporte(
    filters: GetReduccionReporteDto,
  ): Promise<Record<string, unknown>> {
    const reporte = await this.reportesRepository.getReduccionReporte(
      filters.comprobanteId,
      filters.nit,
      filters.daneSede,
    );

    const cabecera = reporte.cabecera as Record<string, unknown> | undefined;
    const totalReduccion = cabecera?.totalReduccion;

    if (cabecera) {
      cabecera.valorEnLetras = numeroAPesosEnLetras(
        totalReduccion as number | string | null | undefined,
      ).toUpperCase();
    }

    return formatearFechasReporte(reporte);
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
      cabecera.valorEnLetras = numeroAPesosEnLetras(
        totalCdpObjeto as number | string | null | undefined,
      ).toUpperCase();
    }

    return formatearFechasReporte(reporte);
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
      cabecera.valorEnLetras = numeroAPesosEnLetras(
        totalCrp as number | string | null | undefined,
      ).toUpperCase();
    }

    return formatearFechasReporte(reporte);
  }
}
