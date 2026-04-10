import { Injectable } from '@nestjs/common';
import { GetLiquidacionPresupuestalReporteDto } from './dto/get-liquidacion-presupuestal-reporte.dto';
import { ReportesRepository } from './reportes.repository';

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
}
