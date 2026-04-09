import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
    return this.reportesService.getLiquidacionPresupuestalReporte({
      comprobanteId,
      nit,
      daneSede,
    });
  }
}
