import pg from 'pg';
import type { JSONSchema7 } from 'json-schema';
import {
  BaseDataSourceDriver,
  DataSourceError,
  type DataSourceFactory,
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

const { Client } = pg;

// JSON Schema for PostgreSQL credentials (standard, portable format)
const postgresCredentialsSchema: JSONSchema7 = {
  type: 'object',
  required: ['host', 'database'],
  properties: {
    host: {
      type: 'string',
      description: 'Database host address',
    },
    port: {
      type: 'integer',
      default: 5432,
      description: 'Database port',
    },
    database: {
      type: 'string',
      description: 'Database name',
    },
    user: {
      type: 'string',
      description: 'Database user',
    },
    password: {
      type: 'string',
      description: 'Database password',
    },
    ssl: {
      type: 'boolean',
      default: false,
      description: 'Enable SSL connection',
    },
  },
};

interface PostgresCredentials {
  host: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export class PostgresDataSource
  extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable, Transactional
{
  private client: InstanceType<typeof Client> | null = null;
  private _name: string = '';
  readonly type = 'postgres';
  readonly queryLanguage: QueryLanguage = 'sql';

  get name(): string {
    return this._name;
  }

  async init(config: DataSourceConfig): Promise<void> {
    this._name = config.id;
    const creds = config.credentials as unknown as PostgresCredentials;

    // Validate required fields
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

    this.client = new Client({
      host: creds.host,
      port: creds.port ?? 5432,
      database: creds.database,
      user: creds.user,
      password: creds.password,
      ssl: creds.ssl ? { rejectUnauthorized: false } : undefined,
    });

    try {
      await this.client.connect();
    } catch (err) {
      this.client = null;
      throw this.wrapError(err);
    }
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.client) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    try {
      const result = await this.client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async introspect(): Promise<SchemaDefinition> {
    if (!this.client) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    try {
      const tablesResult = await this.client.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name
      `);

      const tables: SchemaTable[] = [];

      for (const row of tablesResult.rows) {
        const columnsResult = await this.client.query(
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
      throw this.wrapError(err);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<Transaction> {
    if (!this.client) {
      throw new DataSourceError({
        code: 'NOT_INITIALIZED',
        message: 'Data source not initialized',
        retryable: false,
      });
    }

    try {
      await this.client.query('BEGIN');
    } catch (err) {
      throw this.wrapError(err);
    }

    return {
      execute: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        try {
          const result = await this.client!.query(sql, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? 0,
            fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          };
        } catch (err) {
          throw this.wrapError(err);
        }
      },
      commit: async (): Promise<void> => {
        try {
          await this.client!.query('COMMIT');
        } catch (err) {
          throw this.wrapError(err);
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await this.client!.query('ROLLBACK');
        } catch (err) {
          throw this.wrapError(err);
        }
      },
    };
  }

  /**
   * Wrap PostgreSQL errors in DataSourceError with appropriate codes.
   */
  private wrapError(err: unknown): DataSourceError {
    if (err instanceof DataSourceError) {
      return err;
    }

    const pgErr = err as { code?: string; message?: string; detail?: string };
    const code = pgErr.code;
    const message = pgErr.message ?? 'Unknown database error';

    // Connection errors
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
      return new DataSourceError({
        code: 'CONNECTION_FAILED',
        driverCode: code,
        message: 'Database server unreachable',
        cause: err,
        retryable: true,
      });
    }

    // Authentication errors
    if (code === '28P01' || code === '28000') {
      return new DataSourceError({
        code: 'AUTHENTICATION_FAILED',
        driverCode: code,
        message: 'Invalid database credentials',
        cause: err,
        retryable: false,
      });
    }

    // Syntax errors (Class 42)
    if (code?.startsWith('42')) {
      return new DataSourceError({
        code: 'QUERY_SYNTAX',
        driverCode: code,
        message: message,
        cause: err,
        retryable: false,
      });
    }

    // Constraint violations and execution errors (Class 23)
    if (code?.startsWith('23')) {
      return new DataSourceError({
        code: 'QUERY_EXECUTION',
        driverCode: code,
        message: pgErr.detail ?? message,
        cause: err,
        retryable: false,
      });
    }

    // Query canceled / statement timeout
    if (code === '57014') {
      return new DataSourceError({
        code: 'TIMEOUT',
        driverCode: code,
        message: 'Query timed out',
        cause: err,
        retryable: true,
      });
    }

    // Connection issues during query (may be transient)
    if (code === '08000' || code === '08003' || code === '08006') {
      return new DataSourceError({
        code: 'CONNECTION_FAILED',
        driverCode: code,
        message: 'Connection lost during operation',
        cause: err,
        retryable: true,
      });
    }

    // Default: unknown driver error
    return new DataSourceError({
      code: 'DRIVER_ERROR',
      driverCode: code,
      message: message,
      cause: err,
      retryable: false,
    });
  }
}

export const dataSourceFactory: DataSourceFactory = {
  type: 'postgres',
  displayName: 'PostgreSQL',
  description: 'Connect to PostgreSQL databases',
  iconPath: './assets/postgres.png',
  credentialsSchema: postgresCredentialsSchema,
  credentialsFields: {
    host: { placeholder: 'localhost' },
    port: { type: 'number', placeholder: '5432' },
    database: {},
    user: {},
    password: { type: 'password' },
    ssl: { type: 'boolean', label: 'Use SSL' },
  },
  create: () => new PostgresDataSource(),
};
