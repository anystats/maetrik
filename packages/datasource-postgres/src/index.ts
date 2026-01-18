import pg from 'pg';
import { z } from 'zod';
import {
  BaseDataSourceDriver,
  type DataSourceFactory,
  type DataSourceConfig,
  type DataSourceCapabilities,
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

const postgresCredentialsSchema = z.object({
  host: z.string(),
  port: z.number().default(5432),
  database: z.string(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
});

type PostgresCredentials = z.infer<typeof postgresCredentialsSchema>;

export class PostgresDataSource
  extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable, Transactional
{
  private client: InstanceType<typeof Client> | null = null;
  private _name: string = '';
  readonly type = 'postgres';

  get name(): string {
    return this._name;
  }

  capabilities(): DataSourceCapabilities {
    return {
      queryable: true,
      introspectable: true,
      healthCheckable: true,
      transactional: true,
    };
  }

  async init(config: DataSourceConfig): Promise<void> {
    this._name = config.id;
    const creds = postgresCredentialsSchema.parse(config.credentials);

    this.client = new Client({
      host: creds.host,
      port: creds.port,
      database: creds.database,
      user: creds.user,
      password: creds.password,
      ssl: creds.ssl ? { rejectUnauthorized: false } : undefined,
    });

    await this.client.connect();
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.client) throw new Error('Data source not initialized');

    const result = await this.client.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    };
  }

  async introspect(): Promise<SchemaDefinition> {
    if (!this.client) throw new Error('Data source not initialized');

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
    if (!this.client) throw new Error('Data source not initialized');

    await this.client.query('BEGIN');

    return {
      execute: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
        const result = await this.client!.query(sql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        };
      },
      commit: async (): Promise<void> => {
        await this.client!.query('COMMIT');
      },
      rollback: async (): Promise<void> => {
        await this.client!.query('ROLLBACK');
      },
    };
  }
}

export const dataSourceFactory: DataSourceFactory = {
  type: 'postgres',
  displayName: 'PostgreSQL',
  description: 'Connect to PostgreSQL databases',
  iconPath: './assets/postgres.svg',
  capabilities: {
    queryable: true,
    introspectable: true,
    healthCheckable: true,
    transactional: true,
  },
  credentialsSchema: postgresCredentialsSchema,
  credentialsFields: {
    host: { label: 'Host', placeholder: 'localhost' },
    port: { type: 'number', placeholder: '5432' },
    database: {},  // Label defaults to "Database"
    user: {},      // Label defaults to "User"
    password: { type: 'password' },
    ssl: { type: 'boolean', label: 'Use SSL' },
  },
  create: () => new PostgresDataSource(),
};
