import { Test } from '@nestjs/testing';
import { ReportesRepository } from './reportes.repository';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let service: ReportesService;
  const reportesRepository = {
    getAdicionReporte: jest.fn(),
    getLiquidacionPresupuestalReporte: jest.fn(),
    getReduccionReporte: jest.fn(),
    getTrasladoReporte: jest.fn(),
    getCdpReporte: jest.fn(),
    getCrpReporte: jest.fn(),
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

  it('delegates the adicion reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        adicionId: 1,
        nit: '806013548',
        totalAdicion: '1000000.00',
        fecha: '2026-03-29T19:00:00',
      },
      detalles: [],
      firmas: {},
      generadoEn: '2026-04-22T11:00:00',
    };
    reportesRepository.getAdicionReporte.mockResolvedValue(expected);

    const result = await service.getAdicionReporte({
      comprobanteId: 1,
      nit: '806013548',
      daneSede: '113052000431',
    });

    expect(reportesRepository.getAdicionReporte).toHaveBeenCalledWith(
      1,
      '806013548',
      '113052000431',
    );
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'UN MILLON PESOS',
      },
      generadoEn: '22 de abril del 2026',
    });
  });

  it('delegates the liquidacion reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        id: 45,
        nit: '123456789',
        fecha: '2026-03-29T19:00:00',
        actoAdministrativo: 'ACUERDO No. 007 del 25/10/2024',
        totalIngreso: '46366740.00',
      },
      ingresos: [],
      gastos: [],
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
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'CUARENTA Y SEIS MILLONES TRESCIENTOS SESENTA Y SEIS MIL SETECIENTOS CUARENTA PESOS',
      },
    });
  });

  it('delegates the reduccion reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        reduccionId: 2,
        nit: '806013548',
        totalReduccion: '1500000.00',
        fecha: '2026-03-29T19:00:00',
      },
      detalles: [],
      firmas: {},
      generadoEn: '2026-04-22T11:00:00',
    };
    reportesRepository.getReduccionReporte.mockResolvedValue(expected);

    const result = await service.getReduccionReporte({
      comprobanteId: 2,
      nit: '806013548',
      daneSede: '113052000431',
    });

    expect(reportesRepository.getReduccionReporte).toHaveBeenCalledWith(
      2,
      '806013548',
      '113052000431',
    );
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'UN MILLON QUINIENTOS MIL PESOS',
      },
      generadoEn: '22 de abril del 2026',
    });
  });

  it('delegates the traslado reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        trasladoId: 3,
        nit: '806013548',
        totalTraslado: '1200000.00',
        fecha: '2026-03-29T19:00:00',
      },
      detalles: [],
      firmas: {},
      generadoEn: '2026-04-22T11:00:00',
    };
    reportesRepository.getTrasladoReporte.mockResolvedValue(expected);

    const result = await service.getTrasladoReporte({
      comprobanteId: 3,
      nit: '806013548',
      daneSede: '113052000431',
    });

    expect(reportesRepository.getTrasladoReporte).toHaveBeenCalledWith(
      3,
      '806013548',
      '113052000431',
    );
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'UN MILLON DOSCIENTOS MIL PESOS',
      },
      generadoEn: '22 de abril del 2026',
    });
  });

  it('delegates the cdp reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        cdpId: 40,
        nit: '123456789',
        totalCdpObjeto: '25000000.00',
        fecha: '2026-03-29T19:00:00',
      },
      detalles: [],
      firmas: {},
      generadoEn: '2026-04-22T11:00:00',
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
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'VEINTICINCO MILLONES PESOS',
      },
      generadoEn: '22 de abril del 2026',
    });
  });

  it('delegates the crp reporte query to the repository', async () => {
    const expected = {
      cabecera: {
        crpId: 43,
        nit: '806013548',
        totalCrp: '1000000.00',
        fecha: '2026-03-29T19:00:00',
      },
      detalles: [],
      firmas: {},
      generadoEn: '2026-04-22T11:00:00',
    };
    reportesRepository.getCrpReporte.mockResolvedValue(expected);

    const result = await service.getCrpReporte({
      comprobanteId: 43,
      nit: '806013548',
      daneSede: '113052000431',
    });

    expect(reportesRepository.getCrpReporte).toHaveBeenCalledWith(
      43,
      '806013548',
      '113052000431',
    );
    expect(result).toEqual({
      ...expected,
      cabecera: {
        ...expected.cabecera,
        fecha: '29 de marzo del 2026',
        valorEnLetras: 'UN MILLON PESOS',
      },
      generadoEn: '22 de abril del 2026',
    });
  });
});
