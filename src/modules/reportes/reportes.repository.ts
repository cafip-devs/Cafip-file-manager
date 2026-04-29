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

  async getAdicionReporte(
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
      WITH adicion_base AS (
        SELECT
          ca.id,
          ca.numero_comprobante,
          ca.fecha,
          ca.tipo_documento_id,
          ca.acto_administrativo_id,
          ca.descripcion,
          ca.estado,
          regexp_replace(ca.institucion::text, '[^0-9]', '', 'g') AS nit
        FROM comprobante_adicion ca
        WHERE ca.id = $1
          AND regexp_replace(ca.institucion::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          af.*,
          row_number() OVER (
            PARTITION BY af.tipo_firma
            ORDER BY af.id DESC
          ) AS rn
        FROM adicion_firma af
        JOIN adicion_base ab
          ON ab.id = af.comprobante_id
      ),
      firmas_json AS (
        SELECT jsonb_build_object(
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
          ab.nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion,
          COALESCE(ccip.dane_pri, $3::text) AS dane,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM adicion_base ab
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
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') = ab.nit
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
      tipo_documento_base AS (
        SELECT
          ab.id,
          cds.documento_soporte AS tipo_documento_nombre
        FROM adicion_base ab
        LEFT JOIN catalogo_documentos_soporte_publica cds
          ON cds.id = ab.tipo_documento_id
      ),
      acto_base AS (
        SELECT
          ab.id,
          trim(
            concat_ws(
              ' ',
              nullif(trim(cap.tipo_documento), ''),
              CASE
                WHEN nullif(trim(aa.numero_acto), '') IS NULL THEN NULL
                WHEN cap.tipo_documento ~* '\\mno\\.?\\M'
                  OR aa.numero_acto ~* '\\mno\\.?\\M'
                THEN trim(aa.numero_acto)
                ELSE concat('No. ', trim(aa.numero_acto))
              END,
              CASE
                WHEN aa.fecha IS NULL THEN NULL
                ELSE concat('del ', to_char(aa.fecha, 'DD/MM/YYYY'))
              END
            )
          ) AS acto_administrativo
        FROM adicion_base ab
        LEFT JOIN acto_administrativo aa
          ON aa.id = ab.acto_administrativo_id
        LEFT JOIN catalogo_actos_administrativos_privada cap
          ON cap.id = aa.tipo_acto_administrativo_id
      ),
      detalles_base AS (
        SELECT
          d.id,
          ff.nombre_fuente AS fuente_financiacion,
          COALESCE(ci.id, cg.id) AS rubro_id,
          COALESCE(
            NULLIF(trim(ci.cod_detalle), ''),
            NULLIF(trim(cg.cod_detalle), '')
          ) AS rubro_cuenta,
          COALESCE(ci.concepto, cg.concepto) AS rubro_concepto,
          CASE
            WHEN d.rubro_ingreso_id IS NOT NULL THEN 'INGRESO'
            ELSE 'GASTO'
          END AS tipo,
          d.valor::numeric(18,2) AS valor_adicion
        FROM comprobante_adicion_sede d
        JOIN adicion_base ab
          ON ab.id = d.comprobante_id
        LEFT JOIN catalogo_fuentes_financiacion_publica ff
          ON ff.id = d.fuente_financiacion_id
        LEFT JOIN catalogo_ingresos_publica ci
          ON ci.id = d.rubro_ingreso_id
        LEFT JOIN catalogo_gastos_publica cg
          ON cg.id = d.rubro_gasto_id
      ),
      totales AS (
        SELECT
          COALESCE(SUM(valor_adicion), 0)::numeric(18,2) AS total_adicion
        FROM detalles_base
      )
      SELECT json_build_object(
        'cabecera', json_build_object(
          'adicionId', ab.id,
          'numeroComprobante', ab.numero_comprobante,
          'fecha', ab.fecha,
          'institucion', ib.institucion,
          'nit', ib.nit,
          'dane', ib.dane,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'tipoDocumentoId', ab.tipo_documento_id,
          'tipoDocumentoNombre', tdb.tipo_documento_nombre,
          'actoAdministrativoId', ab.acto_administrativo_id,
          'actoAdministrativo', ato.acto_administrativo,
          'descripcion', ab.descripcion,
          'estado', ab.estado,
          'totalAdicion', t.total_adicion,
          'valorEnLetras', NULL
        ),
        'detalles', COALESCE((
          SELECT json_agg(
            json_build_object(
              'detalleId', d.id,
              'fuenteFinanciacion', d.fuente_financiacion,
              'rubroId', d.rubro_id,
              'rubroCuenta', d.rubro_cuenta,
              'rubroConcepto', d.rubro_concepto,
              'tipo', d.tipo,
              'valorAdicion', d.valor_adicion
            )
            ORDER BY d.id
          )
          FROM detalles_base d
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas::json, '{}'::json),
        'generadoEn', now()
      ) AS reporte
      FROM adicion_base ab
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN tipo_documento_base tdb ON tdb.id = ab.id
      LEFT JOIN acto_base ato ON ato.id = ab.id
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
          NULLIF(trim(cip.cod_detalle), '') AS cuenta,
          COALESCE(
            NULLIF(trim(cip.concepto), ''),
            NULLIF(trim(cip.cod_detalle), '')
          ) AS concepto,
          COALESCE(
            array_length(regexp_split_to_array(trim(cip.cod_detalle), '\\.'), 1),
            0
          ) AS nivel,
          COALESCE(im.valor, 0)::numeric(18,2) AS total
        FROM catalogo_ingresos_publica cip
        JOIN comprobante_base cb
          ON regexp_replace(cip.nit, '[^0-9]', '', 'g') = cb.nit
        LEFT JOIN ingresos_movimientos im
          ON im.rubro_ingreso_id = cip.id
      ),
      ingresos_prefijos AS (
        SELECT DISTINCT
          array_to_string(parts[1:gs], '.') AS cuenta
        FROM ingresos_catalogo ic
        CROSS JOIN LATERAL (
          SELECT regexp_split_to_array(ic.cuenta, '\\.') AS parts
        ) p
        CROSS JOIN LATERAL generate_series(1, array_length(parts, 1) - 1) gs
      ),
      ingresos_completos AS (
        SELECT
          ic.rubro_id,
          ic.cuenta,
          ic.concepto,
          ic.total
        FROM ingresos_catalogo ic

        UNION

        SELECT
          NULL::int AS rubro_id,
          ip.cuenta,
          COALESCE(
            MAX(NULLIF(trim(cip.concepto), '')),
            ip.cuenta
          ) AS concepto,
          COALESCE((
            SELECT SUM(ic2.total)::numeric(18,2)
            FROM ingresos_catalogo ic2
            WHERE ic2.cuenta = ip.cuenta
               OR ic2.cuenta LIKE ip.cuenta || '.%'
          ), 0)::numeric(18,2) AS total
        FROM ingresos_prefijos ip
        LEFT JOIN catalogo_ingresos_publica cip
          ON NULLIF(trim(cip.cod_detalle), '') = ip.cuenta
        GROUP BY ip.cuenta
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
          NULLIF(trim(cgp.cod_detalle), '') AS cuenta,
          COALESCE(
            NULLIF(trim(cgp.concepto), ''),
            NULLIF(trim(cgp.cod_detalle), '')
          ) AS concepto,
          COALESCE(
            array_length(regexp_split_to_array(trim(cgp.cod_detalle), '\\.'), 1),
            0
          ) AS nivel,
          COALESCE(gm.valor, 0)::numeric(18,2) AS total
        FROM catalogo_gastos_publica cgp
        JOIN comprobante_base cb
          ON regexp_replace(cgp.nit, '[^0-9]', '', 'g') = cb.nit
        LEFT JOIN gastos_movimientos gm
          ON gm.rubro_gasto_id = cgp.id
      ),
      gastos_prefijos AS (
        SELECT DISTINCT
          array_to_string(parts[1:gs], '.') AS cuenta
        FROM gastos_catalogo gc
        CROSS JOIN LATERAL (
          SELECT regexp_split_to_array(gc.cuenta, '\\.') AS parts
        ) p
        CROSS JOIN LATERAL generate_series(1, array_length(parts, 1) - 1) gs
      ),
      gastos_completos AS (
        SELECT
          gc.rubro_id,
          gc.cuenta,
          gc.concepto,
          gc.total
        FROM gastos_catalogo gc

        UNION

        SELECT
          NULL::int AS rubro_id,
          gp.cuenta,
          COALESCE(
            MAX(NULLIF(trim(cgp.concepto), '')),
            gp.cuenta
          ) AS concepto,
          COALESCE((
            SELECT SUM(gc2.total)::numeric(18,2)
            FROM gastos_catalogo gc2
            WHERE gc2.cuenta = gp.cuenta
               OR gc2.cuenta LIKE gp.cuenta || '.%'
          ), 0)::numeric(18,2) AS total
        FROM gastos_prefijos gp
        LEFT JOIN catalogo_gastos_publica cgp
          ON NULLIF(trim(cgp.cod_detalle), '') = gp.cuenta
        GROUP BY gp.cuenta
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
          FROM ingresos_completos ic
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
          FROM gastos_completos gc
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

  async getReduccionReporte(
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
      WITH reduccion_base AS (
        SELECT
          cr.id,
          cr.numero_comprobante,
          cr.fecha,
          cr.tipo_documento_id,
          cr.acto_administrativo_id,
          cr.descripcion,
          cr.estado,
          regexp_replace(cr.institucion::text, '[^0-9]', '', 'g') AS nit
        FROM comprobante_reduccion cr
        WHERE cr.id = $1
          AND regexp_replace(cr.institucion::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          rf.*,
          row_number() OVER (
            PARTITION BY rf.tipo_firma
            ORDER BY rf.id DESC
          ) AS rn
        FROM reduccion_firma rf
        JOIN reduccion_base rb
          ON rb.id = rf.comprobante_id
      ),
      firmas_json AS (
        SELECT jsonb_build_object(
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
          rb.nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion,
          COALESCE(ccip.dane_pri, $3::text) AS dane,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM reduccion_base rb
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
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') = rb.nit
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
      tipo_documento_base AS (
        SELECT
          rb.id,
          cds.documento_soporte AS tipo_documento_nombre
        FROM reduccion_base rb
        LEFT JOIN catalogo_documentos_soporte_publica cds
          ON cds.id = rb.tipo_documento_id
      ),
      acto_base AS (
        SELECT
          rb.id,
          trim(
            concat_ws(
              ' ',
              nullif(trim(cap.tipo_documento), ''),
              CASE
                WHEN nullif(trim(aa.numero_acto), '') IS NULL THEN NULL
                WHEN cap.tipo_documento ~* '\\mno\\.?\\M'
                  OR aa.numero_acto ~* '\\mno\\.?\\M'
                THEN trim(aa.numero_acto)
                ELSE concat('No. ', trim(aa.numero_acto))
              END,
              CASE
                WHEN aa.fecha IS NULL THEN NULL
                ELSE concat('del ', to_char(aa.fecha, 'DD/MM/YYYY'))
              END
            )
          ) AS acto_administrativo
        FROM reduccion_base rb
        LEFT JOIN acto_administrativo aa
          ON aa.id = rb.acto_administrativo_id
        LEFT JOIN catalogo_actos_administrativos_privada cap
          ON cap.id = aa.tipo_acto_administrativo_id
      ),
      detalles_base AS (
        SELECT
          d.id,
          ff.nombre_fuente AS fuente_financiacion,
          COALESCE(ci.id, cg.id) AS rubro_id,
          COALESCE(
            NULLIF(trim(ci.cod_detalle), ''),
            NULLIF(trim(cg.cod_detalle), '')
          ) AS rubro_cuenta,
          COALESCE(ci.concepto, cg.concepto) AS rubro_concepto,
          CASE
            WHEN d.rubro_ingreso_id IS NOT NULL THEN 'INGRESO'
            ELSE 'GASTO'
          END AS tipo,
          d.valor::numeric(18,2) AS valor_reduccion
        FROM comprobante_reduccion_sede d
        JOIN reduccion_base rb
          ON rb.id = d.comprobante_id
        LEFT JOIN catalogo_fuentes_financiacion_publica ff
          ON ff.id = d.fuente_financiacion_id
        LEFT JOIN catalogo_ingresos_publica ci
          ON ci.id = d.rubro_ingreso_id
        LEFT JOIN catalogo_gastos_publica cg
          ON cg.id = d.rubro_gasto_id
      ),
      totales AS (
        SELECT
          COALESCE(SUM(valor_reduccion), 0)::numeric(18,2) AS total_reduccion
        FROM detalles_base
      )
      SELECT json_build_object(
        'cabecera', json_build_object(
          'reduccionId', rb.id,
          'numeroComprobante', rb.numero_comprobante,
          'fecha', rb.fecha,
          'institucion', ib.institucion,
          'nit', ib.nit,
          'dane', ib.dane,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'tipoDocumentoId', rb.tipo_documento_id,
          'tipoDocumentoNombre', tdb.tipo_documento_nombre,
          'actoAdministrativoId', rb.acto_administrativo_id,
          'actoAdministrativo', ato.acto_administrativo,
          'descripcion', rb.descripcion,
          'estado', rb.estado,
          'totalReduccion', t.total_reduccion,
          'valorEnLetras', NULL
        ),
        'detalles', COALESCE((
          SELECT json_agg(
            json_build_object(
              'detalleId', d.id,
              'fuenteFinanciacion', d.fuente_financiacion,
              'rubroId', d.rubro_id,
              'rubroCuenta', d.rubro_cuenta,
              'rubroConcepto', d.rubro_concepto,
              'tipo', d.tipo,
              'valorReduccion', d.valor_reduccion
            )
            ORDER BY d.id
          )
          FROM detalles_base d
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas::json, '{}'::json),
        'generadoEn', now()
      ) AS reporte
      FROM reduccion_base rb
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN tipo_documento_base tdb ON tdb.id = rb.id
      LEFT JOIN acto_base ato ON ato.id = rb.id
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

  async getTrasladoReporte(
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
      WITH traslado_base AS (
        SELECT
          ct.id,
          ct.numero_comprobante,
          ct.fecha,
          ct.tipo_documento_id,
          ct.acto_administrativo_id,
          ct.descripcion,
          ct.estado,
          regexp_replace(ct.institucion::text, '[^0-9]', '', 'g') AS nit
        FROM comprobante_traslado ct
        WHERE ct.id = $1
          AND regexp_replace(ct.institucion::text, '[^0-9]', '', 'g') = $2
      ),
      firmas_ranked AS (
        SELECT
          tf.*,
          row_number() OVER (
            PARTITION BY tf.tipo_firma
            ORDER BY tf.id DESC
          ) AS rn
        FROM traslado_firma tf
        JOIN traslado_base tb
          ON tb.id = tf.comprobante_id
      ),
      firmas_json AS (
        SELECT jsonb_build_object(
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
          tb.nit,
          COALESCE(ccip.institucion_educativa, cep.nombre_establecimiento) AS institucion,
          COALESCE(ccip.dane_pri, $3::text) AS dane,
          COALESCE(ccip.email, cep.email) AS email,
          cep.municipio,
          ccdp.departamento
        FROM traslado_base tb
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
          WHERE regexp_replace(cep.nit_fse, '[^0-9]', '', 'g') = tb.nit
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
      tipo_documento_base AS (
        SELECT
          tb.id,
          cds.documento_soporte AS tipo_documento_nombre
        FROM traslado_base tb
        LEFT JOIN catalogo_documentos_soporte_publica cds
          ON cds.id = tb.tipo_documento_id
      ),
      acto_base AS (
        SELECT
          tb.id,
          trim(
            concat_ws(
              ' ',
              nullif(trim(cap.tipo_documento), ''),
              CASE
                WHEN nullif(trim(aa.numero_acto), '') IS NULL THEN NULL
                WHEN cap.tipo_documento ~* '\\mno\\.?\\M'
                  OR aa.numero_acto ~* '\\mno\\.?\\M'
                THEN trim(aa.numero_acto)
                ELSE concat('No. ', trim(aa.numero_acto))
              END,
              CASE
                WHEN aa.fecha IS NULL THEN NULL
                ELSE concat('del ', to_char(aa.fecha, 'DD/MM/YYYY'))
              END
            )
          ) AS acto_administrativo
        FROM traslado_base tb
        LEFT JOIN acto_administrativo aa
          ON aa.id = tb.acto_administrativo_id
        LEFT JOIN catalogo_actos_administrativos_privada cap
          ON cap.id = aa.tipo_acto_administrativo_id
      ),
      detalles_base AS (
        SELECT
          d.id,
          ff.nombre_fuente AS fuente_financiacion,
          d.rubro_gasto_id AS rubro_id,
          NULLIF(trim(cg.cod_detalle), '') AS rubro_cuenta,
          cg.concepto AS rubro_concepto,
          CASE
            WHEN COALESCE(d.valor_contracredito, 0) > 0 THEN 'CONTRACREDITO'
            ELSE 'CREDITO'
          END AS tipo,
          COALESCE(d.valor_credito, d.valor_contracredito, 0)::numeric(18,2) AS valor_traslado
        FROM comprobante_traslado_sede d
        JOIN traslado_base tb
          ON tb.id = d.comprobante_id
        LEFT JOIN catalogo_fuentes_financiacion_publica ff
          ON ff.id = d.fuente_financiacion_id
        LEFT JOIN catalogo_gastos_publica cg
          ON cg.id = d.rubro_gasto_id
      ),
      totales AS (
        SELECT
          COALESCE(SUM(valor_traslado), 0)::numeric(18,2) AS total_traslado
        FROM detalles_base
      )
      SELECT json_build_object(
        'cabecera', json_build_object(
          'trasladoId', tb.id,
          'numeroComprobante', tb.numero_comprobante,
          'fecha', tb.fecha,
          'institucion', ib.institucion,
          'nit', ib.nit,
          'dane', ib.dane,
          'email', ib.email,
          'municipio', ib.municipio,
          'departamento', ib.departamento,
          'tipoDocumentoId', tb.tipo_documento_id,
          'tipoDocumentoNombre', tdb.tipo_documento_nombre,
          'actoAdministrativoId', tb.acto_administrativo_id,
          'actoAdministrativo', ato.acto_administrativo,
          'descripcion', tb.descripcion,
          'estado', tb.estado,
          'totalTraslado', t.total_traslado,
          'valorEnLetras', NULL
        ),
        'detalles', COALESCE((
          SELECT json_agg(
            json_build_object(
              'detalleId', d.id,
              'fuenteFinanciacion', d.fuente_financiacion,
              'rubroId', d.rubro_id,
              'rubroCuenta', d.rubro_cuenta,
              'rubroConcepto', d.rubro_concepto,
              'tipo', d.tipo,
              'valorTraslado', d.valor_traslado
            )
            ORDER BY d.id
          )
          FROM detalles_base d
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas::json, '{}'::json),
        'generadoEn', now()
      ) AS reporte
      FROM traslado_base tb
      LEFT JOIN institucion_base ib ON true
      LEFT JOIN tipo_documento_base tdb ON tdb.id = tb.id
      LEFT JOIN acto_base ato ON ato.id = tb.id
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
          NULLIF(trim(g.cod_detalle), '') AS rubro_cuenta,
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
      SELECT json_build_object(
        'cabecera', json_build_object(
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
        'detalles', COALESCE((
          SELECT json_agg(
            json_build_object(
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
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas::json, '{}'::json),
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
          NULLIF(trim(cg.cod_detalle), '') AS rubro_cuenta,
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
      SELECT json_build_object(
        'cabecera', json_build_object(
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
          SELECT json_agg(
            json_build_object(
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
        ), '[]'::json),
        'firmas', COALESCE(fj.firmas::json, '{}'::json),
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
