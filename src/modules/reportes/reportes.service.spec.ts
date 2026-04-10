import { Test } from '@nestjs/testing';
import { ReportesRepository } from './reportes.repository';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  const reportesRepository = {
    getLiquidacionPresupuestalReporte: jest.fn(),
    getCdpReporte: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportesService,
        {
          provide: ReportesRepository,
          useValue: reportesRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(ReportesService);
  });

  it('delegates the liquidacion reporte query to the repository', async () => {
    const expected = {
      comprobante: { id: 45, nit: '123456789' },
      ingresos: { rubros: [] },
      gastos: { rubros: [] },
      firmas: {},
    };
    reportesRepository.getLiquidacionPresupuestalReporte.mockResolvedValue(
      expected,
    );

    const result = await service.getLiquidacionPresupuestalReporte({
      comprobanteId: 45,
      nit: '123456789',
      daneSede: '123456789012',
    });

    expect(
      reportesRepository.getLiquidacionPresupuestalReporte,
    ).toHaveBeenCalledWith(45, '123456789', '123456789012');
    expect(result).toBe(expected);
  });

  it('delegates the cdp reporte query to the repository', async () => {
    const expected = {
      cabecera: { cdpId: 40, nit: '123456789', totalCdpObjeto: '25000000.00' },
      detalles: [],
      firmas: {},
    };
    reportesRepository.getCdpReporte.mockResolvedValue(expected);

    const result = await service.getCdpReporte({
      comprobanteId: 40,
      nit: '123456789',
      daneSede: '123456789012',
    });

    expect(reportesRepository.getCdpReporte).toHaveBeenCalledWith(
      40,
      '123456789',
      '123456789012',
    );
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        valorEnLetras: 'veinticinco millones pesos con 00/100 m/cte',
      },
    });
  });
});
