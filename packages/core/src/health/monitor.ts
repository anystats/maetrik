import type { StateDatabase, HealthStatus } from '../state/types.js';
import type { DataSourceManager } from '../datasources/types.js';

const BUCKET_MS = 30 * 60 * 1000; // 30 minutes

function computeBucketStart(date: Date = new Date()): Date {
  return new Date(Math.floor(date.getTime() / BUCKET_MS) * BUCKET_MS);
}

export interface HealthMonitorOptions {
  stateDb: StateDatabase;
  dataSourceManager: DataSourceManager;
  intervalMs?: number; // default 5 minutes
}

export class HealthMonitor {
  private readonly stateDb: StateDatabase;
  private readonly dataSourceManager: DataSourceManager;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: HealthMonitorOptions) {
    this.stateDb = options.stateDb;
    this.dataSourceManager = options.dataSourceManager;
    this.intervalMs = options.intervalMs ?? 5 * 60 * 1000;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.runOnce().catch(() => {}), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    const connections = await this.stateDb.listConnections();
    const bucketStart = computeBucketStart();

    for (const conn of connections) {
      if (!conn.enabled) continue;

      // Prune old stats
      await this.stateDb.pruneHealthStats(conn.id);

      // Check if current bucket already has a record
      const stats = await this.stateDb.getHealthStats(conn.id);
      const hasBucket = stats.some(
        (s) => s.bucket_start.getTime() === bucketStart.getTime()
      );
      if (hasBucket) continue;

      // No bucket — run healthcheck
      await this.checkConnection(conn.id, conn.health_thresholds, bucketStart);
    }
  }

  private async checkConnection(
    connectionId: string,
    thresholds: { connection_ms: number },
    bucketStart: Date,
  ): Promise<void> {
    let driver;
    try {
      driver = await this.dataSourceManager.connectById(connectionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.stateDb.updateConnectionHealth(connectionId, 'red');
      await this.stateDb.upsertHealthStats(connectionId, bucketStart, 'red', message);
      return;
    }

    try {
      if (!driver.isHealthCheckable()) {
        await this.stateDb.upsertHealthStats(connectionId, bucketStart, 'green');
        await this.stateDb.updateConnectionHealth(connectionId, 'green');
        return;
      }

      const start = Date.now();
      await driver.healthCheck();
      const elapsed = Date.now() - start;

      let status: HealthStatus = 'green';
      let message: string | undefined;

      if (elapsed > thresholds.connection_ms) {
        status = 'yellow';
        message = `Slow response: ${elapsed}ms (threshold: ${thresholds.connection_ms}ms)`;
      }

      await this.stateDb.updateConnectionHealth(connectionId, status);
      await this.stateDb.upsertHealthStats(connectionId, bucketStart, status, message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.stateDb.updateConnectionHealth(connectionId, 'red');
      await this.stateDb.upsertHealthStats(connectionId, bucketStart, 'red', message);
    } finally {
      await driver.shutdown();
    }
  }
}
