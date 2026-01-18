import { PGlite } from '@electric-sql/pglite';
import type {
  StateDatabase,
  ConnectionRow,
  CreateConnectionInput,
  UpdateConnectionInput,
} from './types.js';

export class PGLiteStateDatabase implements StateDatabase {
  private db: PGlite | null = null;
  private readonly path: string;

  constructor(path: string = './data/state.db') {
    this.path = path;
  }

  async initialize(): Promise<void> {
    this.db = new PGlite(this.path);
    await this.db.waitReady;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        credentials JSONB NOT NULL,
        name TEXT,
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT false,
        meta JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.db) throw new Error('State database not initialized');
    const result = await this.db.query<T>(sql, params);
    return result.rows;
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    if (!this.db) throw new Error('State database not initialized');
    if (params && params.length > 0) {
      // Use query for parameterized statements since exec doesn't support params
      await this.db.query(sql, params);
    } else {
      await this.db.exec(sql);
    }
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async createConnection(input: CreateConnectionInput): Promise<void> {
    if (!this.db) throw new Error('State database not initialized');
    await this.db.query(
      `INSERT INTO connections (id, type, credentials, name, description, enabled, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.id,
        input.type,
        JSON.stringify(input.credentials),
        input.name ?? null,
        input.description ?? null,
        false,  // Connections always start disabled
        JSON.stringify({}),  // Empty meta
      ]
    );
  }

  async getConnection(id: string): Promise<ConnectionRow | undefined> {
    if (!this.db) throw new Error('State database not initialized');
    const result = await this.db.query<ConnectionRow>(
      'SELECT id, type, credentials, name, description, enabled, meta, created_at, updated_at FROM connections WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async listConnections(): Promise<ConnectionRow[]> {
    if (!this.db) throw new Error('State database not initialized');
    const result = await this.db.query<ConnectionRow>(
      'SELECT id, type, credentials, name, description, enabled, meta, created_at, updated_at FROM connections ORDER BY created_at'
    );
    return result.rows;
  }

  async connectionExists(id: string): Promise<boolean> {
    if (!this.db) throw new Error('State database not initialized');
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM connections WHERE id = $1',
      [id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  async updateConnection(id: string, input: UpdateConnectionInput): Promise<void> {
    if (!this.db) throw new Error('State database not initialized');
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.credentials !== undefined) {
      sets.push(`credentials = $${paramIndex++}`);
      params.push(JSON.stringify(input.credentials));
    }
    if (input.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.enabled !== undefined) {
      sets.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }

    params.push(id);
    await this.db.query(
      `UPDATE connections SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  async deleteConnection(id: string): Promise<void> {
    if (!this.db) throw new Error('State database not initialized');
    await this.db.query('DELETE FROM connections WHERE id = $1', [id]);
  }
}
