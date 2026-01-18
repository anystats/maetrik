import type { StateDatabase, StateDatabaseConfig } from './types.js';
import { PGLiteStateDatabase } from './pglite.js';
import { PostgresStateDatabase } from './postgres.js';

export function createStateDatabase(config: StateDatabaseConfig): StateDatabase {
  switch (config.type) {
    case 'pglite':
      return new PGLiteStateDatabase(config.path ?? './data/state.db');

    case 'postgres':
      if (!config.connectionString) {
        throw new Error('PostgreSQL state database requires connectionString');
      }
      return new PostgresStateDatabase(config.connectionString);

    default:
      throw new Error(`Unknown state database type: ${(config as any).type}`);
  }
}
