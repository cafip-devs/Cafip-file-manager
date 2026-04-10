import { Test } from '@nestjs/testing';
import { ReportesRepository } from './reportes.repository';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  const reportesRepository = {
    getLiquidacionPresupuestalReporte: jest.fn(),
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

  it('delegates the full reporte query to the repository', async () => {
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
    });

    expect(reportesRepository.getLiquidacionPresupuestalReporte).toHaveBeenCalledWith(
      45,
      '123456789',
    );
    expect(result).toBe(expected);
  });
});
