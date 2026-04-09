import { Logger, Provider } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ComprobanteAsignacionSede } from '../modules/reportes/entities/comprobante-asignacion-sede.entity';
import { ComprobantePresupuestal } from '../modules/reportes/entities/comprobante-presupuestal.entity';
import { RubroGastoInfoFinanciera } from '../modules/reportes/entities/rubro-gasto-info-financiera.entity';

export const REPORTES_DATA_SOURCE = 'REPORTES_DATA_SOURCE';

const buildReportesDataSource = () => {
  // Build connection from individual PG_* variables or fallback to DATABASE_URL
  const pgUser = process.env.PG_USER?.trim();
  const pgHost = process.env.PG_HOST?.trim();
  const pgName = process.env.PG_NAME?.trim();
  const pgPassword = process.env.PG_PASSWORD?.trim();
  const pgPort = process.env.PG_PORT?.trim();

  const hasPgVars = pgUser && pgHost && pgName && pgPassword && pgPort;
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!hasPgVars && !databaseUrl) {
    return null;
  }

  const options: DataSourceOptions = hasPgVars
    ? {
        type: 'postgres',
        host: pgHost,
        port: parseInt(pgPort, 10),
        username: pgUser,
        password: pgPassword,
        database: pgName,
        entities: [
          ComprobantePresupuestal,
          ComprobanteAsignacionSede,
          RubroGastoInfoFinanciera,
        ],
        synchronize: false,
        logging: ['error', 'warn'],
        extra: {
          max: parseInt(process.env.PG_POOL_MAX || '20', 10),
          min: parseInt(process.env.PG_POOL_MIN || '2', 10),
          idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
          connectionTimeoutMillis: parseInt(
            process.env.PG_CONNECTION_TIMEOUT_MS || '5000',
            10,
          ),
          statement_timeout: parseInt(
            process.env.PG_STATEMENT_TIMEOUT_MS || '10000',
            10,
          ),
          query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT_MS || '10000', 10),
        },
      }
    : {
        type: 'postgres',
        url: databaseUrl,
        entities: [
          ComprobantePresupuestal,
          ComprobanteAsignacionSede,
          RubroGastoInfoFinanciera,
        ],
        synchronize: false,
        logging: ['error', 'warn'],
        extra: {
          max: parseInt(process.env.PG_POOL_MAX || '20', 10),
          min: parseInt(process.env.PG_POOL_MIN || '2', 10),
          idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10),
          connectionTimeoutMillis: parseInt(
            process.env.PG_CONNECTION_TIMEOUT_MS || '5000',
            10,
          ),
          statement_timeout: parseInt(
            process.env.PG_STATEMENT_TIMEOUT_MS || '10000',
            10,
          ),
          query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT_MS || '10000', 10),
        },
      };

  return new DataSource(options);
};

export const reportesDataSourceProvider: Provider = {
  provide: REPORTES_DATA_SOURCE,
  useFactory: async () => {
    const logger = new Logger('ReportesDataSource');
    const dataSource = buildReportesDataSource();

    if (!dataSource) {
      logger.warn(
        'Variables de conexión PostgreSQL no configuradas (PG_USER, PG_HOST, PG_NAME, PG_PASSWORD, PG_PORT) ni DATABASE_URL. El módulo de reportes quedará deshabilitado.',
      );
      return null;
    }

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      logger.log('Conexión TypeORM para reportes inicializada');
    }

    return dataSource;
  },
};
