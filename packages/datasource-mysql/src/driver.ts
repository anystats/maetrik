import mysql from 'mysql2/promise';
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

interface MysqlCredentials {
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

export class MysqlDataSource
  extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable, Transactional
{
  private pool: mysql.Pool | null = null;
  private _name: string = '';
  readonly type = 'mysql';
  readonly queryLanguage: QueryLanguage = 'sql';

  get name(): string {
    return this._name;
  }

  async init(config: DataSourceConfig): Promise<void> {
    this._name = config.id;
    const creds = config.credentials as unknown as MysqlCredentials;

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

    this.pool = mysql.createPool({
      host: creds.host,
      port: creds.port ?? 3306,
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
      connectionLimit: config.connection?.maxConnections ?? 10,
      idleTimeout: config.connection?.idleTimeoutMs ?? 30000,
      connectTimeout: config.connection?.timeoutMs ?? 5000,
    });

    let conn: mysql.PoolConnection | undefined;
    try {
      conn = await this.pool.getConnection();
    } catch (err) {
      await this.pool.end();
      this.pool = null;
      throw wrapError(err);
    } finally {
      conn?.release();
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
      const [rows, fields] = await this.pool.execute(sql, params as (string | number | null | Buffer)[]);
      const resultRows = Array.isArray(rows) ? rows : [];
      const resultFields = Array.isArray(fields) ? fields : [];

      return {
        rows: resultRows as Record<string, unknown>[],
        rowCount: resultRows.length,
        fields: resultFields.map((f) => ({ name: f.name, dataTypeID: f.type })),
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
      const [rows] = await this.pool.execute(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);

      const tableRows = rows as Array<{ table_schema: string; table_name: string }>;
      const tables: SchemaTable[] = [];

      for (const row of tableRows) {
        const [columnRows] = await this.pool.execute(
          `
          SELECT
            c.COLUMN_NAME as column_name,
            c.DATA_TYPE as data_type,
            c.IS_NULLABLE as is_nullable,
            CASE WHEN c.COLUMN_KEY = 'PRI' THEN true ELSE false END as is_primary_key
          FROM information_schema.columns c
          WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
          ORDER BY c.ORDINAL_POSITION
          `,
          [row.table_schema, row.table_name]
        );

        const cols = columnRows as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          is_primary_key: number;
        }>;

        tables.push({
          name: row.table_name,
          schema: row.table_schema,
          columns: cols.map((col) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            isPrimaryKey: Boolean(col.is_primary_key),
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
      await this.pool.execute('SELECT 1');
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

    let conn: mysql.PoolConnection;
    try {
      conn = await this.pool.getConnection();
    } catch (err) {
      throw wrapError(err);
    }

    try {
      await conn.beginTransaction();
    } catch (err) {
      conn.release();
      throw wrapError(err);
    }

    return {
      execute: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        try {
          const [rows, fields] = await conn.execute(sql, params as (string | number | null | Buffer)[]);
          const resultRows = Array.isArray(rows) ? rows : [];
          const resultFields = Array.isArray(fields) ? fields : [];

          return {
            rows: resultRows as Record<string, unknown>[],
            rowCount: resultRows.length,
            fields: resultFields.map((f) => ({ name: f.name, dataTypeID: f.type })),
          };
        } catch (err) {
          throw wrapError(err);
        }
      },
      commit: async (): Promise<void> => {
        try {
          await conn.commit();
        } finally {
          conn.release();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await conn.rollback();
        } finally {
          conn.release();
        }
      },
    };
  }
}
