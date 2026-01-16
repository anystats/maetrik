import pg from 'pg';
import type {
  DatabaseDriver,
  DriverCapabilities,
  SchemaDefinition,
  QueryResult,
  ConnectionConfig,
} from '@maetrik/shared';
import type { DriverFactory } from '../types.js';

const { Client } = pg;

export function createPostgresDriver(): DatabaseDriver {
  let client: InstanceType<typeof Client> | null = null;

  return {
    name: 'postgres',
    dialect: 'postgresql',

    async init(config: ConnectionConfig): Promise<void> {
      client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      });
      await client.connect();
    },

    async healthCheck(): Promise<boolean> {
      if (!client) return false;
      try {
        await client.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },

    async shutdown(): Promise<void> {
      if (client) {
        await client.end();
        client = null;
      }
    },

    async introspect(): Promise<SchemaDefinition> {
      // Will be implemented in Task 5
      return { tables: {} };
    },

    async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
      if (!client) {
        throw new Error('Driver not initialized');
      }
      const result = await client.query(sql, params);
      return {
        columns: result.fields.map((f) => f.name),
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
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
