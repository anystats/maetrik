import { Client } from 'pg';
import type {
  StateDatabase,
  ConnectionRow,
  CreateConnectionInput,
  UpdateConnectionInput,
} from './types.js';

export class PostgresStateDatabase implements StateDatabase {
  private client: Client | null = null;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    this.client = new Client({ connectionString: this.connectionString });
    await this.client.connect();

    await this.client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        credentials JSONB NOT NULL,
        name TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(sql, params);
    return result.rows as T[];
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query(sql, params);
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async createConnection(input: CreateConnectionInput): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query(
      `INSERT INTO connections (id, type, credentials, name, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.id,
        input.type,
        JSON.stringify(input.credentials),
        input.name ?? null,
        input.description ?? null,
      ]
    );
  }

  async getConnection(id: string): Promise<ConnectionRow | undefined> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT id, type, credentials, name, description, created_at, updated_at FROM connections WHERE id = $1',
      [id]
    );
    return result.rows[0] as ConnectionRow | undefined;
  }

  async listConnections(): Promise<ConnectionRow[]> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT id, type, credentials, name, description, created_at, updated_at FROM connections ORDER BY created_at'
    );
    return result.rows as ConnectionRow[];
  }

  async connectionExists(id: string): Promise<boolean> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT COUNT(*) as count FROM connections WHERE id = $1',
      [id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  async updateConnection(id: string, input: UpdateConnectionInput): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
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

    params.push(id);
    await this.client.query(
      `UPDATE connections SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  async deleteConnection(id: string): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query('DELETE FROM connections WHERE id = $1', [id]);
  }
}
