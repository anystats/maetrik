import { Client } from 'pg';
import type { StateDatabase } from './types.js';

export class PostgresStateDatabase implements StateDatabase {
  private client: Client | null = null;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    this.client = new Client({ connectionString: this.connectionString });
    await this.client.connect();
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
}
