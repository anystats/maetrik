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
      logger.debug('Introspecting database schema');
      // Will be implemented in Task 5
      return { tables: {} };
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
