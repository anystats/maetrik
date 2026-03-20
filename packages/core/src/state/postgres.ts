import { Client } from 'pg';
import type {
  StateDatabase,
  ConnectionRow,
  CreateConnectionInput,
  UpdateConnectionInput,
  HealthBucketRow,
  HealthStatus,
} from './types.js';

const SEVERITY: Record<string, number> = { green: 0, yellow: 1, red: 2 };

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
        options JSONB NOT NULL,
        name TEXT,
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT false,
        health_status TEXT NOT NULL DEFAULT 'green',
        health_thresholds JSONB NOT NULL DEFAULT '{"connection_ms": 2000}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.client.query(`
      CREATE TABLE IF NOT EXISTS connection_health_log (
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        bucket_start TIMESTAMP NOT NULL,
        health_status TEXT NOT NULL DEFAULT 'green',
        degradation_message TEXT,
        PRIMARY KEY (connection_id, bucket_start)
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
      `INSERT INTO connections (id, type, options, name, description, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.id,
        input.type,
        JSON.stringify(input.options),
        input.name ?? null,
        input.description ?? null,
        false,  // Connections always start disabled
      ]
    );
  }

  async getConnection(id: string): Promise<ConnectionRow | undefined> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT id, type, options, name, description, enabled, health_status, health_thresholds, created_at, updated_at FROM connections WHERE id = $1',
      [id]
    );
    return result.rows[0] as ConnectionRow | undefined;
  }

  async listConnections(): Promise<ConnectionRow[]> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT id, type, options, name, description, enabled, health_status, health_thresholds, created_at, updated_at FROM connections ORDER BY created_at'
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

    if (input.options !== undefined) {
      sets.push(`options = $${paramIndex++}`);
      params.push(JSON.stringify(input.options));
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
    await this.client.query(
      `UPDATE connections SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  }

  async deleteConnection(id: string): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query('DELETE FROM connections WHERE id = $1', [id]);
  }

  async updateConnectionHealth(id: string, healthStatus: HealthStatus): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query(
      'UPDATE connections SET health_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [healthStatus, id]
    );
  }

  async upsertHealthStats(connectionId: string, bucketStart: Date, healthStatus: HealthStatus, message?: string): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    const existing = await this.client.query(
      'SELECT health_status FROM connection_health_log WHERE connection_id = $1 AND bucket_start = $2',
      [connectionId, bucketStart]
    );

    if (existing.rows.length === 0) {
      await this.client.query(
        'INSERT INTO connection_health_log (connection_id, bucket_start, health_status, degradation_message) VALUES ($1, $2, $3, $4)',
        [connectionId, bucketStart, healthStatus, message ?? null]
      );
    } else {
      const currentSeverity = SEVERITY[existing.rows[0].health_status] ?? 0;
      const newSeverity = SEVERITY[healthStatus] ?? 0;
      if (newSeverity > currentSeverity) {
        await this.client.query(
          'UPDATE connection_health_log SET health_status = $1, degradation_message = $2 WHERE connection_id = $3 AND bucket_start = $4',
          [healthStatus, message ?? null, connectionId, bucketStart]
        );
      }
    }
  }

  async getHealthStats(connectionId: string): Promise<HealthBucketRow[]> {
    if (!this.client) throw new Error('State database not initialized');
    const result = await this.client.query(
      'SELECT connection_id, bucket_start, health_status, degradation_message FROM connection_health_log WHERE connection_id = $1 ORDER BY bucket_start',
      [connectionId]
    );
    return result.rows as HealthBucketRow[];
  }

  async pruneHealthStats(connectionId: string): Promise<void> {
    if (!this.client) throw new Error('State database not initialized');
    await this.client.query(
      "DELETE FROM connection_health_log WHERE connection_id = $1 AND bucket_start < NOW() - INTERVAL '48 hours'",
      [connectionId]
    );
  }
}
