import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthMonitor } from './monitor.js';
import type { StateDatabase } from '../state/types.js';
import type { DataSourceManager } from '../datasources/types.js';

function currentBucketStart(): Date {
  const now = new Date();
  const bucketMs = 30 * 60 * 1000;
  return new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
}

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;
  let stateDb: StateDatabase;
  let dataSourceManager: DataSourceManager;

  beforeEach(() => {
    stateDb = {
      listConnections: vi.fn().mockResolvedValue([]),
      getConnection: vi.fn().mockResolvedValue(undefined),
      updateConnectionHealth: vi.fn().mockResolvedValue(undefined),
      upsertHealthStats: vi.fn().mockResolvedValue(undefined),
      getHealthStats: vi.fn().mockResolvedValue([]),
      pruneHealthStats: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
      shutdown: vi.fn(),
      createConnection: vi.fn(),
      connectionExists: vi.fn(),
      updateConnection: vi.fn(),
      deleteConnection: vi.fn(),
    } as unknown as StateDatabase;

    dataSourceManager = {
      connectById: vi.fn(),
    } as unknown as DataSourceManager;

    monitor = new HealthMonitor({ stateDb, dataSourceManager, intervalMs: 60000 });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('skips check when current bucket already exists', async () => {
    const bucket = currentBucketStart();
    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([
      { connection_id: 'conn-1', bucket_start: bucket, health_status: 'green' },
    ]);

    await monitor.runOnce();
    expect(dataSourceManager.connectById).not.toHaveBeenCalled();
  });

  it('runs healthcheck when no bucket exists for current window', async () => {
    const mockDriver = {
      isHealthCheckable: () => true,
      healthCheck: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dataSourceManager.connectById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDriver);

    await monitor.runOnce();

    expect(dataSourceManager.connectById).toHaveBeenCalledWith('conn-1');
    expect(mockDriver.healthCheck).toHaveBeenCalled();
    expect(stateDb.upsertHealthStats).toHaveBeenCalled();
    expect(stateDb.updateConnectionHealth).toHaveBeenCalled();
    expect(mockDriver.shutdown).toHaveBeenCalled();
  });

  it('marks connection red on healthcheck failure', async () => {
    const mockDriver = {
      isHealthCheckable: () => true,
      healthCheck: vi.fn().mockRejectedValue(new Error('Connection refused')),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dataSourceManager.connectById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDriver);

    await monitor.runOnce();

    expect(stateDb.updateConnectionHealth).toHaveBeenCalledWith('conn-1', 'red');
    expect(stateDb.upsertHealthStats).toHaveBeenCalledWith('conn-1', expect.any(Date), 'red', 'Connection refused');
  });

  it('marks connection yellow when response time exceeds threshold', async () => {
    const mockDriver = {
      isHealthCheckable: () => true,
      healthCheck: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 50))),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 10 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dataSourceManager.connectById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDriver);

    await monitor.runOnce();

    expect(stateDb.updateConnectionHealth).toHaveBeenCalledWith('conn-1', 'yellow');
  });

  it('marks connection red on connect failure', async () => {
    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (dataSourceManager.connectById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

    await monitor.runOnce();

    expect(stateDb.updateConnectionHealth).toHaveBeenCalledWith('conn-1', 'red');
  });

  it('skips disabled connections', async () => {
    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: false, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);

    await monitor.runOnce();

    expect(dataSourceManager.connectById).not.toHaveBeenCalled();
  });

  it('prunes old stats on each run', async () => {
    (stateDb.listConnections as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'conn-1', type: 'postgres', enabled: true, health_status: 'green', health_thresholds: { connection_ms: 2000 } },
    ]);
    (stateDb.getHealthStats as ReturnType<typeof vi.fn>).mockResolvedValue([
      { connection_id: 'conn-1', bucket_start: currentBucketStart(), health_status: 'green' },
    ]);

    await monitor.runOnce();

    expect(stateDb.pruneHealthStats).toHaveBeenCalledWith('conn-1');
  });
});
