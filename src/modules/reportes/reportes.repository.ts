import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REPORTES_DATA_SOURCE } from '../../database/reportes-data-source.provider';

@Injectable()
export class ReportesRepository {
  constructor(
    @Inject(REPORTES_DATA_SOURCE)
    private readonly dataSource: DataSource | null,
  ) {}

  async getLiquidacionPresupuestalReporte(
    comprobanteId: number,
    nit: string,
    daneSede: string,
  ): Promise<Record<string, unknown>> {
    if (!this.dataSource) {
      throw new ServiceUnavailableException(
        'La conexión a PostgreSQL no está configurada. Define PG_USER, PG_HOST, PG_NAME, PG_PASSWORD, PG_PORT o DATABASE_URL para consultar reportes.',
      );
    }

    const normalizedNit = nit.replace(/\D/g, '');
    if (!normalizedNit) {
      throw new BadRequestException('No fue posible interpretar el NIT enviado.');
    }

    const sql = `
      WITH comprobante_base AS (
        SELECT
          cp.id,
          cp.numero_comprobante,
          cp.fecha,
          EXTRACT(YEAR FROM cp.fecha)::int AS vigencia,
          regexp_replace(cp.institucion::text, '[^0-9]', '', 'g') AS nit
        FROM comprobante_presupuestal cp
        WHERE cp.id = $1
          AND regexp_replace(cp.institucion::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          aif.*,
          row_number() OVER (
            PARTITION BY aif.tipo_firma
            ORDER BY aif.id DESC
          ) AS rn
        FROM asignacion_inicial_firma aif
        JOIN comprobante_base cb
          ON cb.id = aif.comprobante_id
      ),
      firmas_json AS (
        SELECT json_build_object(
          'elaboradoPor',
          (
            SELECT json_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'numeroDocumento', fr.numero_documento,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'ELABORADO' AND fr.rn = 1
          ),
          'revisadoPor',
          (
            SELECT json_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'numeroDocumento', fr.numero_documento,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'REVISADO' AND fr.rn = 1
          ),
          'rector',
          (
            SELECT json_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'numeroDocumento', fr.numero_documento,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'APROBADO' AND fr.rn = 1
          )
        ) AS firmas
      ),
      institucion_base AS (
        SELECT
          cb.nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion_educativa,
          COALESCE(ccip.dane_pri, $3::text) AS dane_pri,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM comprobante_base cb
        LEFT JOIN LATERAL (
          SELECT ccip.institucion_educativa, ccip.dane_pri, ccip.email
          FROM catalogo_correo_institucional_privada ccip
          WHERE ccip.dane_pri = $3
            AND COALESCE(ccip.estado, 'ACTIVO') = 'ACTIVO'
          ORDER BY ccip.id DESC
          LIMIT 1
        ) ccip ON true
        LEFT JOIN LATERAL (
          SELECT cep.nombre_establecimiento, cep.email, cep.municipio
          FROM catalogo_entidades_privada cep
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') = cb.nit
          ORDER BY cep.id DESC
          LIMIT 1
        ) cep ON true
        LEFT JOIN LATERAL (
          SELECT ccdp.departamento
          FROM catalogo_ciudades_departamentos_privada ccdp
          WHERE upper(trim(ccdp.nombre_municipio)) = upper(trim(cep.municipio))
          ORDER BY ccdp.id DESC
          LIMIT 1
        ) ccdp ON true
      ),
      detalles_vigencia AS (
        SELECT
          cas.rubro_ingreso_id,
          cas.rubro_gasto_id,
          cas.valor::numeric(18,2) AS valor
        FROM comprobante_asignacion_sede cas
        JOIN comprobante_presupuestal cp
          ON cp.id = cas.comprobante_id
        JOIN comprobante_base cb
          ON regexp_replace(cp.institucion::text, '[^0-9]', '', 'g') = cb.nit
         AND EXTRACT(YEAR FROM cp.fecha)::int = cb.vigencia
        WHERE cp.estado = 'APROBADO'
      ),
      ingresos_movimientos AS (
        SELECT
          dv.rubro_ingreso_id,
          SUM(dv.valor)::numeric(18,2) AS valor
        FROM detalles_vigencia dv
        WHERE dv.rubro_ingreso_id IS NOT NULL
        GROUP BY dv.rubro_ingreso_id
      ),
      ingresos_catalogo AS (
        SELECT
          cip.id AS rubro_id,
          cip.cuenta,
          COALESCE(NULLIF(trim(cip.concepto), ''), cip.cuenta) AS concepto,
          cip.nivel,
          COALESCE(im.valor, 0)::numeric(18,2) AS total
        FROM catalogo_ingresos_publica cip
        JOIN comprobante_base cb
          ON regexp_replace(cip.nit, '[^0-9]', '', 'g') = cb.nit
        LEFT JOIN ingresos_movimientos im
          ON im.rubro_ingreso_id = cip.id
      ),
      gastos_movimientos AS (
        SELECT
          dv.rubro_gasto_id,
          SUM(dv.valor)::numeric(18,2) AS valor
        FROM detalles_vigencia dv
        WHERE dv.rubro_gasto_id IS NOT NULL
        GROUP BY dv.rubro_gasto_id
      ),
      gastos_catalogo AS (
        SELECT
          cgp.id AS rubro_id,
          cgp.cuenta,
          COALESCE(NULLIF(trim(cgp.concepto), ''), cgp.cuenta) AS concepto,
          cgp.nivel,
          COALESCE(gm.valor, 0)::numeric(18,2) AS total
        FROM catalogo_gastos_publica cgp
        JOIN comprobante_base cb
          ON regexp_replace(cgp.nit, '[^0-9]', '', 'g') = cb.nit
        LEFT JOIN gastos_movimientos gm
          ON gm.rubro_gasto_id = cgp.id
      )
      SELECT json_build_object(
        'cabecera', json_build_object(
          'id', cb.id,
          'numeroComprobante', cb.numero_comprobante,
          'fecha', cb.fecha,
          'vigencia', cb.vigencia,
          'nit', cb.nit,
          'institucionEducativa', ib.institucion_educativa,
          'danePri', ib.dane_pri,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'generadoEn', now()
        ),
        'ingresos', COALESCE((
          SELECT json_agg(
            json_build_object(
              'rubroId', ic.rubro_id,
              'cuenta', ic.cuenta,
              'concepto', ic.concepto,
              'total', ic.total,
              'ingresosProyectados', round((ic.total / 10.0)::numeric, 2)
            )
            ORDER BY ic.cuenta
          )
          FROM ingresos_catalogo ic
        ), '[]'::json),
        'gastos', COALESCE((
          SELECT json_agg(
            json_build_object(
              'rubroId', gc.rubro_id,
              'cuenta', gc.cuenta,
              'concepto', gc.concepto,
              'total', gc.total,
              'ingresosProyectados', round((gc.total / 10.0)::numeric, 2)
            )
            ORDER BY gc.cuenta
          )
          FROM gastos_catalogo gc
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas, '{}'::json)
      ) AS reporte
      FROM comprobante_base cb
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN firmas_json fj ON true
    `;

    const result = await this.dataSource.query(sql, [
      comprobanteId,
      normalizedNit,
      daneSede,
    ]);
    const reporte = result?.[0]?.reporte;

    if (!reporte) {
      throw new NotFoundException(
        `No se encontró el comprobante ${comprobanteId} para el NIT ${normalizedNit}.`,
      );
    }

    return reporte as Record<string, unknown>;
  }

  async getCdpReporte(
    comprobanteId: number,
    nit: string,
    daneSede: string,
  ): Promise<Record<string, unknown>> {
    if (!this.dataSource) {
      throw new ServiceUnavailableException(
        'La conexión a PostgreSQL no está configurada. Define PG_USER, PG_HOST, PG_NAME, PG_PASSWORD, PG_PORT o DATABASE_URL para consultar reportes.',
      );
    }

    const normalizedNit = nit.replace(/\D/g, '');
    if (!normalizedNit) {
      throw new BadRequestException('No fue posible interpretar el NIT enviado.');
    }

    const sql = `
      WITH cdp_base AS (
        SELECT
          c.id,
          c.numero_comprobante,
          c.fecha,
          c.institucion_id,
          c.estado,
          c.objeto
        FROM cdp c
        WHERE c.id = $1
          AND regexp_replace(c.institucion_id::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          cf.*,
          row_number() OVER (
            PARTITION BY cf.tipo_firma
            ORDER BY cf.id DESC
          ) AS rn
        FROM cdp_firma cf
        JOIN cdp_base cb
          ON cb.id = cf.cdp_id
      ),
      firmas_json AS (
        SELECT jsonb_build_object(
          'elaboradoPor',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'ELABORADO' AND fr.rn = 1
          ),
          'revisadoPor',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'REVISADO' AND fr.rn = 1
          ),
          'rector',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'APROBADO' AND fr.rn = 1
          )
        ) AS firmas
      ),
      institucion_base AS (
        SELECT
          regexp_replace(cb.institucion_id::text, '[^0-9]', '', 'g') AS nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion_educativa,
          COALESCE(ccip.dane_pri, $3::text) AS dane_pri,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM cdp_base cb
        LEFT JOIN LATERAL (
          SELECT ccip.institucion_educativa, ccip.dane_pri, ccip.email
          FROM catalogo_correo_institucional_privada ccip
          WHERE ccip.dane_pri = $3
            AND COALESCE(ccip.estado, 'ACTIVO') = 'ACTIVO'
          ORDER BY ccip.id DESC
          LIMIT 1
        ) ccip ON true
        LEFT JOIN LATERAL (
          SELECT cep.nombre_establecimiento, cep.email, cep.municipio
          FROM catalogo_entidades_privada cep
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') =
            regexp_replace(cb.institucion_id::text, '[^0-9]', '', 'g')
          ORDER BY cep.id DESC
          LIMIT 1
        ) cep ON true
        LEFT JOIN LATERAL (
          SELECT ccdp.departamento
          FROM catalogo_ciudades_departamentos_privada ccdp
          WHERE upper(trim(ccdp.nombre_municipio)) = upper(trim(cep.municipio))
          ORDER BY ccdp.id DESC
          LIMIT 1
        ) ccdp ON true
      ),
      detalles_base AS (
        SELECT
          d.id,
          f.nombre_fuente AS fuente_financiacion,
          d.rubro_gasto_id,
          g.cuenta AS rubro_cuenta,
          g.concepto AS rubro_concepto,
          d.valor_cdp::numeric(18,2) AS valor_cdp_detalle
        FROM cdp_detalle d
        JOIN cdp_base cb
          ON cb.id = d.cdp_id
        LEFT JOIN catalogo_fuentes_financiacion_publica f
          ON f.id = d.fuente_financiacion_id
        LEFT JOIN catalogo_gastos_publica g
          ON g.id = d.rubro_gasto_id
      ),
      totales AS (
        SELECT
          COALESCE(SUM(valor_cdp_detalle), 0)::numeric(18,2) AS total_cdp_objeto
        FROM detalles_base
      )
      SELECT jsonb_build_object(
        'cabecera', jsonb_build_object(
          'cdpId', cb.id,
          'numeroComprobante', cb.numero_comprobante,
          'fecha', cb.fecha,
          'objeto', cb.objeto,
          'institucion', ib.institucion_educativa,
          'nit', ib.nit,
          'dane', ib.dane_pri,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'totalCdpObjeto', t.total_cdp_objeto,
          'valorEnLetras', NULL
        ),
        'firmas', COALESCE(fj.firmas, '{}'::jsonb),
        'detalles', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'detalleId', d.id,
              'fuenteFinanciacion', d.fuente_financiacion,
              'rubroId', d.rubro_gasto_id,
              'rubroCuenta', d.rubro_cuenta,
              'rubroConcepto', d.rubro_concepto,
              'valorCdpDetalle', d.valor_cdp_detalle
            )
            ORDER BY d.id
          )
          FROM detalles_base d
        ), '[]'::jsonb),
        'generadoEn', now()
      ) AS reporte
      FROM cdp_base cb
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN firmas_json fj ON true
      LEFT JOIN totales t ON true
    `;

    const result = await this.dataSource.query(sql, [
      comprobanteId,
      normalizedNit,
      daneSede,
    ]);
    const reporte = result?.[0]?.reporte;

    if (!reporte) {
      throw new NotFoundException(
        `No se encontró el comprobante ${comprobanteId} para el NIT ${normalizedNit}.`,
      );
    }

    return reporte as Record<string, unknown>;
  }

  async getCrpReporte(
    comprobanteId: number,
    nit: string,
    daneSede: string,
  ): Promise<Record<string, unknown>> {
    if (!this.dataSource) {
      throw new ServiceUnavailableException(
        'La conexión a PostgreSQL no está configurada. Define PG_USER, PG_HOST, PG_NAME, PG_PASSWORD, PG_PORT o DATABASE_URL para consultar reportes.',
      );
    }

    const normalizedNit = nit.replace(/\D/g, '');
    if (!normalizedNit) {
      throw new BadRequestException('No fue posible interpretar el NIT enviado.');
    }

    const sql = `
      WITH crp_base AS (
        SELECT
          c.id,
          c.numero_crp,
          c.fecha,
          c.contrato_id,
          c.cdp_id,
          c.estado,
          regexp_replace(c.institucion_id::text, '[^0-9]', '', 'g') AS nit
        FROM crp c
        WHERE c.id = $1
          AND regexp_replace(c.institucion_id::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          cf.*,
          row_number() OVER (
            PARTITION BY cf.tipo_firma
            ORDER BY cf.id DESC
          ) AS rn
        FROM crp_firma cf
        JOIN crp_base cb
          ON cb.id = cf.crp_id
      ),
      firmas_json AS (
        SELECT jsonb_build_object(
          'elaboradoPor',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'ELABORADO' AND fr.rn = 1
          ),
          'revisadoPor',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'REVISADO' AND fr.rn = 1
          ),
          'rector',
          (
            SELECT jsonb_build_object(
              'nombre', fr.nombre,
              'cargo', fr.cargo,
              'archivoUrl', fr.archivo_url
            )
            FROM firmas_ranked fr
            WHERE fr.tipo_firma = 'APROBADO' AND fr.rn = 1
          )
        ) AS firmas
      ),
      institucion_base AS (
        SELECT
          cb.nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion,
          COALESCE(ccip.dane_pri, $3::text) AS dane,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM crp_base cb
        LEFT JOIN LATERAL (
          SELECT ccip.institucion_educativa, ccip.dane_pri, ccip.email
          FROM catalogo_correo_institucional_privada ccip
          WHERE ccip.dane_pri = $3
            AND COALESCE(ccip.estado, 'ACTIVO') = 'ACTIVO'
          ORDER BY ccip.id DESC
          LIMIT 1
        ) ccip ON true
        LEFT JOIN LATERAL (
          SELECT cep.nombre_establecimiento, cep.email, cep.municipio
          FROM catalogo_entidades_privada cep
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') = cb.nit
          ORDER BY cep.id DESC
          LIMIT 1
        ) cep ON true
        LEFT JOIN LATERAL (
          SELECT ccdp.departamento
          FROM catalogo_ciudades_departamentos_privada ccdp
          WHERE upper(trim(ccdp.nombre_municipio)) = upper(trim(cep.municipio))
          ORDER BY ccdp.id DESC
          LIMIT 1
        ) ccdp ON true
      ),
      cabecera_base AS (
        SELECT
          cb.id,
          cb.numero_crp,
          cb.fecha,
          con.numero_contrato,
          TRIM(
            CONCAT(
              COALESCE(t.primer_nombre, ''),
              ' ',
              COALESCE(t.primer_apellido, '')
            )
          ) AS beneficiario,
          COALESCE(NULLIF(t.nit, ''), t.documento::text) AS cc_o_nit_beneficiario,
          cdp.numero_comprobante AS disponibilidad,
          cdp.objeto
        FROM crp_base cb
        LEFT JOIN contrato con
          ON con.id = cb.contrato_id
        LEFT JOIN terceros t
          ON t.id = con.tercero_id
        LEFT JOIN cdp
          ON cdp.id = cb.cdp_id
      ),
      detalles_base AS (
        SELECT
          d.id,
          ff.nombre_fuente AS fuente_financiacion,
          d.rubro_gastos_id,
          cg.cuenta AS rubro_cuenta,
          cg.concepto AS rubro_concepto,
          d.valor_crp::numeric(18,2) AS valor_crp_detalle
        FROM crp_detalles d
        JOIN crp_base cb
          ON cb.id = d.crp_id
        LEFT JOIN catalogo_fuentes_financiacion_publica ff
          ON ff.id = d.fuente_financiacion_id
        LEFT JOIN catalogo_gastos_publica cg
          ON cg.id = d.rubro_gastos_id
      ),
      totales AS (
        SELECT
          COALESCE(SUM(valor_crp_detalle), 0)::numeric(18,2) AS total_crp
        FROM detalles_base
      )
      SELECT jsonb_build_object(
        'cabecera', jsonb_build_object(
          'crpId', cab.id,
          'numeroComprobante', cab.numero_crp,
          'fecha', cab.fecha,
          'institucion', ib.institucion,
          'nit', ib.nit,
          'dane', ib.dane,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'objeto', cab.objeto,
          'beneficiario', NULLIF(cab.beneficiario, ''),
          'ccONitBeneficiario', cab.cc_o_nit_beneficiario,
          'contrato', cab.numero_contrato,
          'disponibilidad', cab.disponibilidad,
          'totalCrp', t.total_crp,
          'valorEnLetras', NULL
        ),
        'detalles', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'detalleId', d.id,
              'fuenteFinanciacion', d.fuente_financiacion,
              'rubroId', d.rubro_gastos_id,
              'rubroCuenta', d.rubro_cuenta,
              'rubroConcepto', d.rubro_concepto,
              'valorCrpDetalle', d.valor_crp_detalle
            )
            ORDER BY d.id
          )
          FROM detalles_base d
        ), '[]'::jsonb),
        'firmas', COALESCE(fj.firmas, '{}'::jsonb),
        'generadoEn', now()
      ) AS reporte
      FROM cabecera_base cab
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN totales t ON true
      LEFT JOIN firmas_json fj ON true
    `;

    const result = await this.dataSource.query(sql, [
      comprobanteId,
      normalizedNit,
      daneSede,
    ]);
    const reporte = result?.[0]?.reporte;

    if (!reporte) {
      throw new NotFoundException(
        `No se encontró el comprobante ${comprobanteId} para el NIT ${normalizedNit}.`,
      );
    }

    return reporte as Record<string, unknown>;
  }
}
