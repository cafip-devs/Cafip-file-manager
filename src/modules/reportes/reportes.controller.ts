import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetCdpReporteDto } from './dto/get-cdp-reporte.dto';
import { GetCrpReporteDto } from './dto/get-crp-reporte.dto';
import { GetLiquidacionPresupuestalReporteDto } from './dto/get-liquidacion-presupuestal-reporte.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('liquidacion-presupuestal/:comprobanteId')
  @ApiOperation({
    summary: 'Consultar reporte de liquidacion presupuestal',
    description:
      'Devuelve el reporte de liquidacion presupuestal por comprobante y NIT, incluyendo firmas, datos institucionales, rubros acumulados de la vigencia y totalizadoras.',
  })
  @ApiParam({ name: 'comprobanteId', type: Number, example: 45 })
  @ApiQuery({ name: 'nit', type: String, example: '123456789' })
  @ApiQuery({ name: 'daneSede', type: String, example: '123456789012' })
  @ApiOkResponse({
    schema: {
      type: 'object',
    },
  })
  getLiquidacionPresupuestalReporte(
    @Param('comprobanteId', ParseIntPipe) comprobanteId: number,
    @Query('nit') nit: string,
    @Query('daneSede') daneSede: string,
  ): Promise<Record<string, unknown>> {
    const filters: GetLiquidacionPresupuestalReporteDto = {
      comprobanteId,
      nit,
      daneSede,
    };

    return this.reportesService.getLiquidacionPresupuestalReporte(filters);
  }

  @Get('cdp/:comprobanteId')
  @ApiOperation({
    summary: 'Consultar reporte de CDP',
    description:
      'Devuelve el reporte de CDP por comprobante y NIT, incluyendo cabecera, detalles y firmas.',
  })
  @ApiParam({ name: 'comprobanteId', type: Number, example: 34 })
  @ApiQuery({ name: 'nit', type: String, example: '806013548' })
  @ApiQuery({ name: 'daneSede', type: String, example: '113052000431' })
  @ApiOkResponse({
    schema: {
      type: 'object',
    },
  })
  getCdpReporte(
    @Param('comprobanteId', ParseIntPipe) comprobanteId: number,
    @Query('nit') nit: string,
    @Query('daneSede') daneSede: string,
  ): Promise<Record<string, unknown>> {
    const filters: GetCdpReporteDto = {
      comprobanteId,
      nit,
      daneSede,
    };

    return this.reportesService.getCdpReporte(filters);
  }

  @Get('crp/:comprobanteId')
  @ApiOperation({
    summary: 'Consultar reporte de CRP',
    description:
      'Devuelve el reporte de CRP por comprobante y NIT, incluyendo cabecera, detalles, disponibilidad asociada, beneficiario y firmas.',
  })
  @ApiParam({ name: 'comprobanteId', type: Number, example: 43 })
  @ApiQuery({ name: 'nit', type: String, example: '806013548' })
  @ApiQuery({ name: 'daneSede', type: String, example: '113052000431' })
  @ApiOkResponse({
    schema: {
      type: 'object',
    },
  })
  getCrpReporte(
    @Param('comprobanteId', ParseIntPipe) comprobanteId: number,
    @Query('nit') nit: string,
    @Query('daneSede') daneSede: string,
  ): Promise<Record<string, unknown>> {
    const filters: GetCrpReporteDto = {
      comprobanteId,
      nit,
      daneSede,
    };

    return this.reportesService.getCrpReporte(filters);
  }
}
