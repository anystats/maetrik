import type { StateDatabase, HealthStatus, ConnectionRow } from '../state/types.js';
import { DEFAULT_HEALTH_THRESHOLDS } from '../state/types.js';
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
    // Use dataSourceManager to get ALL connections (file-config + database-stored)
    const configs = await this.dataSourceManager.listConfigs();
    // Get database connections for metadata (enabled flag, thresholds)
    const dbConnections = await this.stateDb.listConnections();
    const dbMap = new Map<string, ConnectionRow>(dbConnections.map(c => [c.id, c]));

    const bucketStart = computeBucketStart();

    for (const config of configs) {
      const dbConn = dbMap.get(config.id);
      // File-config connections are always enabled; DB connections check enabled flag
      const enabled = dbConn?.enabled ?? true;
      if (!enabled) continue;

      const thresholds = dbConn?.health_thresholds ?? DEFAULT_HEALTH_THRESHOLDS;

      // Prune old stats
      await this.stateDb.pruneHealthStats(config.id);

      // Check if current bucket already has a record
      const stats = await this.stateDb.getHealthStats(config.id);
      const hasBucket = stats.some(
        (s) => s.bucket_start.getTime() === bucketStart.getTime()
      );
      if (hasBucket) continue;

      // No bucket — run healthcheck
      await this.checkConnection(config.id, thresholds, bucketStart);
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
