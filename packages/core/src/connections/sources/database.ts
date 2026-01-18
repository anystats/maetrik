import type { StateDatabase } from '../../state/types.js';
import type { ConnectionConfig, ConnectionConfigSource } from '../types.js';

export class DatabaseConnectionConfigSource implements ConnectionConfigSource {
  readonly name = 'database';
  private readonly db: StateDatabase;

  constructor(db: StateDatabase) {
    this.db = db;
  }

  async get(id: string): Promise<ConnectionConfig | undefined> {
    const row = await this.db.getConnection(id);
    if (!row) return undefined;
    return {
      id: row.id,
      type: row.type,
      credentials: row.credentials,
    };
  }

  async list(): Promise<ConnectionConfig[]> {
    const rows = await this.db.listConnections();
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      credentials: row.credentials,
    }));
  }

  async has(id: string): Promise<boolean> {
    return this.db.connectionExists(id);
  }
}
