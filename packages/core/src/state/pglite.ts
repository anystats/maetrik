import { PGlite } from '@electric-sql/pglite';
import type { StateDatabase } from './types.js';

export class PGLiteStateDatabase implements StateDatabase {
  private db: PGlite | null = null;
  private readonly path: string;

  constructor(path: string = './data/state.db') {
    this.path = path;
  }

  async initialize(): Promise<void> {
    this.db = new PGlite(this.path);
    await this.db.waitReady;
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
}
