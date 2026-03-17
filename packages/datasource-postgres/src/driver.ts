import pg from 'pg';
import {
  BaseDataSourceDriver,
  DataSourceError,
  type DataSourceConfig,
  type QueryLanguage,
  type DataSourceQueryResult as QueryResult,
  type DataSourceSchemaDefinition as SchemaDefinition,
  type DataSourceSchemaTable as SchemaTable,
  type Transaction,
  type Queryable,
  type Introspectable,
  type HealthCheckable,
  type Transactional,
} from '@maetrik/shared';
import { wrapError } from './errors.js';

const { Pool } = pg;

interface PostgresCredentials {
  host: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

export class PostgresDataSource
  extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable, Transactional
{
  private pool: InstanceType<typeof Pool> | null = null;
  private _name: string = '';
  readonly type = 'postgres';
  readonly queryLanguage: QueryLanguage = 'sql';

  get name(): string {
    return this._name;
  }

  async init(config: DataSourceConfig): Promise<void> {
    this._name = config.id;
    const creds = config.credentials as unknown as PostgresCredentials;

    if (!creds.host) {
      throw new DataSourceError({
        code: 'CONNECTION_FAILED',
        message: 'Missing required credential: host',
        retryable: false,
      });
    }
    if (!creds.database) {
      throw new DataSourceError({
        code: 'CONNECTION_FAILED',
        message: 'Missing required credential: database',
        retryable: false,
      });
    }

    this.pool = new Pool({
      host: creds.host,
      port: creds.port ?? 5432,
      database: creds.database,
      user: creds.user,
      password: creds.password,
      ssl: creds.ssl
        ? {
            rejectUnauthorized: creds.rejectUnauthorized ?? true,
            ca: creds.ca,
            cert: creds.cert,
            key: creds.key,
          }
        : undefined,
      max: config.connection?.maxConnections ?? 10,
      idleTimeoutMillis: config.connection?.idleTimeoutMs ?? 30000,
      connectionTimeoutMillis: config.connection?.timeoutMs ?? 5000,
    });

    try {
      const client = await this.pool.connect();
      client.release();
    } catch (err) {
      await this.pool.end();
      this.pool = null;
      throw wrapError(err);
    }
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    try {
      const result = await this.pool.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      };
    } catch (err) {
      throw wrapError(err);
    }
  }

  async introspect(): Promise<SchemaDefinition> {
    if (!this.pool) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    try {
      const tablesResult = await this.pool.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

      const tables: SchemaTable[] = [];

      for (const row of tablesResult.rows) {
        const columnsResult = await this.pool.query(
          `
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position
        `,
          [row.table_schema, row.table_name]
        );

        tables.push({
          name: row.table_name,
          schema: row.table_schema,
          columns: columnsResult.rows.map((col) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            isPrimaryKey: col.is_primary_key,
          })),
        });
      }

      return { tables };
    } catch (err) {
      throw wrapError(err);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<Transaction> {
    if (!this.pool) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    let client: pg.PoolClient;
    try {
      client = await this.pool.connect();
    } catch (err) {
      throw wrapError(err);
    }

    try {
      await client.query('BEGIN');
    } catch (err) {
      client.release();
      throw wrapError(err);
    }

    return {
      execute: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        try {
          const result = await client.query(sql, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? 0,
            fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          };
        } catch (err) {
          throw wrapError(err);
        }
      },
      commit: async (): Promise<void> => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      },
    };
  }
}
