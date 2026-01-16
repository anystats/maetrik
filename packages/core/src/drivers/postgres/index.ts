import pg from 'pg';
import {
  createLogger,
  type DatabaseDriver,
  type DriverCapabilities,
  type SchemaDefinition,
  type QueryResult,
  type ConnectionConfig,
} from '@maetrik/shared';
import type { DriverFactory } from '../types.js';

const { Client } = pg;

export function createPostgresDriver(): DatabaseDriver {
  let client: InstanceType<typeof Client> | null = null;
  const logger = createLogger('postgres-driver');

  return {
    name: 'postgres',
    dialect: 'postgresql',

    async init(config: ConnectionConfig): Promise<void> {
      logger.info('Initializing PostgreSQL connection', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
      });

      client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      });

      try {
        await client.connect();
        logger.info('PostgreSQL connection established');
      } catch (error) {
        logger.error('Failed to connect to PostgreSQL', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    async healthCheck(): Promise<boolean> {
      if (!client) {
        logger.warn('Health check called but client not initialized');
        return false;
      }
      try {
        await client.query('SELECT 1');
        logger.debug('Health check passed');
        return true;
      } catch (error) {
        logger.warn('Health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },

    async shutdown(): Promise<void> {
      if (client) {
        logger.info('Shutting down PostgreSQL connection');
        await client.end();
        client = null;
        logger.info('PostgreSQL connection closed');
      }
    },

    async introspect(): Promise<SchemaDefinition> {
      if (!client) {
        logger.error('Introspect called but driver not initialized');
        throw new Error('Driver not initialized');
      }

      logger.debug('Introspecting database schema');

      // Get all tables
      const tablesResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      // Get all columns
      const columnsResult = await client.query(`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      // Get primary key columns
      const pkResult = await client.query(`
        SELECT
          t.tablename as table_name,
          i.indexdef
        FROM pg_indexes i
        JOIN pg_tables t ON t.tablename = i.tablename
        WHERE t.schemaname = 'public'
          AND (i.indexdef LIKE '%PRIMARY KEY%' OR i.indexname LIKE '%_pkey')
      `);

      // Build primary key lookup
      const primaryKeys = new Map<string, Set<string>>();
      for (const row of pkResult.rows) {
        const tableName = row.table_name as string;
        const indexDef = row.indexdef as string;
        // Extract column names from index definition
        const match = indexDef.match(/\(([^)]+)\)/);
        if (match) {
          const cols = match[1].split(',').map((c) => c.trim());
          if (!primaryKeys.has(tableName)) {
            primaryKeys.set(tableName, new Set());
          }
          for (const col of cols) {
            primaryKeys.get(tableName)!.add(col);
          }
        }
      }

      // Build schema definition
      const tables: SchemaDefinition['tables'] = {};

      for (const tableRow of tablesResult.rows) {
        const tableName = tableRow.table_name as string;
        const tableColumns = columnsResult.rows.filter(
          (c) => c.table_name === tableName
        );

        tables[tableName] = {
          name: tableName,
          columns: tableColumns.map((col) => ({
            name: col.column_name as string,
            type: col.data_type as string,
            nullable: col.is_nullable === 'YES',
            primaryKey: primaryKeys.get(tableName)?.has(col.column_name as string) ?? false,
          })),
        };
      }

      logger.debug('Schema introspection complete', {
        tableCount: Object.keys(tables).length,
      });

      return { tables };
    },

    async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
      if (!client) {
        logger.error('Execute called but driver not initialized');
        throw new Error('Driver not initialized');
      }

      const startTime = Date.now();
      logger.debug('Executing query', { sql: sql.substring(0, 100) });

      try {
        const result = await client.query(sql, params);
        const duration = Date.now() - startTime;

        logger.debug('Query executed successfully', {
          rowCount: result.rowCount,
          duration,
        });

        return {
          columns: result.fields.map((f) => f.name),
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Query execution failed', {
          sql: sql.substring(0, 100),
          duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    capabilities(): DriverCapabilities {
      return {
        streaming: false,
        explain: true,
        timeout: true,
      };
    },
  };
}

export const postgresDriverFactory: DriverFactory = {
  name: 'postgres',
  dialect: 'postgresql',
  create: createPostgresDriver,
};
